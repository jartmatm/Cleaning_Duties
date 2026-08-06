import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!["PATCH", "DELETE"].includes(request.method)) {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase function credentials are unavailable" }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);

  if (authError || !authData.user) {
    return jsonResponse({ error: "Your session is no longer valid" }, 401);
  }

  let payload: {
    member_id?: string;
    cleaner_id?: string;
    company_id?: string;
    full_name?: string;
    email?: string;
    password?: string;
    site_ids?: string[];
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const memberId = payload.member_id ?? payload.cleaner_id ?? "";
  const companyId = payload.company_id ?? "";

  if (!uuidPattern.test(memberId)) return jsonResponse({ error: "A valid team member is required" }, 400);
  if (!uuidPattern.test(companyId)) return jsonResponse({ error: "A valid company is required" }, 400);

  const { data: requester, error: requesterError } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError) {
    return jsonResponse({ error: errorMessage(requesterError, "Could not verify your profile") }, 500);
  }
  if (!requester || requester.company_id !== companyId || !["Manager", "Supervisor"].includes(requester.role)) {
    return jsonResponse({ error: "You are not allowed to manage team members for this company" }, 403);
  }

  const { data: member, error: memberError } = await admin
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) return jsonResponse({ error: errorMessage(memberError, "Could not verify team member") }, 500);
  if (!member || member.company_id !== companyId || !["Supervisor", "Cleaner"].includes(member.role)) {
    return jsonResponse({ error: "Team member not found in this company" }, 404);
  }
  if (requester.role === "Supervisor" && member.role !== "Cleaner") {
    return jsonResponse({ error: "Supervisors can only manage cleaner accounts" }, 403);
  }

  const { data: requesterMemberships, error: requesterMembershipsError } = requester.role === "Supervisor"
    ? await admin.from("site_members").select("site_id").eq("profile_id", authData.user.id)
    : { data: [], error: null };
  if (requesterMembershipsError) {
    return jsonResponse({ error: errorMessage(requesterMembershipsError, "Could not verify supervisor site access") }, 500);
  }
  const requesterSiteIds = (requesterMemberships ?? []).map((membership) => membership.site_id as string);

  const { data: currentMemberships, error: currentMembershipsError } = await admin
    .from("site_members")
    .select("site_id")
    .eq("profile_id", memberId);
  if (currentMembershipsError) {
    return jsonResponse({ error: errorMessage(currentMembershipsError, "Could not verify current site access") }, 500);
  }
  const currentSiteIds = (currentMemberships ?? []).map((membership) => membership.site_id as string);

  if (requester.role === "Supervisor" && !currentSiteIds.some((siteId) => requesterSiteIds.includes(siteId))) {
    return jsonResponse({ error: "This cleaner is not assigned to one of your sites" }, 403);
  }

  if (request.method === "DELETE") {
    const removableSiteIds = requester.role === "Manager" ? currentSiteIds : requesterSiteIds;
    const { data: removableDuties, error: removableDutiesError } = removableSiteIds.length > 0
      ? await admin.from("cleaning_duties").select("id").in("site_id", removableSiteIds)
      : { data: [], error: null };
    if (removableDutiesError) {
      return jsonResponse({ error: errorMessage(removableDutiesError, "Could not verify duty assignments") }, 500);
    }

    const removableDutyIds = (removableDuties ?? []).map((duty) => duty.id as string);
    if (removableDutyIds.length > 0) {
      const { error: assignmentError } = await admin
        .from("duty_assignments")
        .delete()
        .eq("profile_id", memberId)
        .in("duty_id", removableDutyIds);
      if (assignmentError) return jsonResponse({ error: errorMessage(assignmentError, "Could not remove duty assignments") }, 500);
    }

    let membershipDelete = admin.from("site_members").delete().eq("profile_id", memberId);
    if (requester.role === "Supervisor") {
      membershipDelete = membershipDelete.in("site_id", requesterSiteIds);
    }
    const { error: membershipError } = await membershipDelete;
    if (membershipError) return jsonResponse({ error: errorMessage(membershipError, "Could not remove site access") }, 500);

    const { count: remainingMembershipCount, error: remainingMembershipError } = await admin
      .from("site_members")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", memberId);
    if (remainingMembershipError) {
      return jsonResponse({ error: errorMessage(remainingMembershipError, "Could not verify remaining site access") }, 500);
    }

    const shouldDeleteAccount = requester.role === "Manager" || (remainingMembershipCount ?? 0) === 0;
    if (shouldDeleteAccount) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(memberId);
      if (deleteUserError) return jsonResponse({ error: errorMessage(deleteUserError, "Could not delete team member account") }, 500);
    }

    return jsonResponse({ userId: memberId, accountDeleted: shouldDeleteAccount });
  }

  const fullName = payload.full_name?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const siteIds = Array.isArray(payload.site_ids) ? [...new Set(payload.site_ids)] : [];

  if (fullName.length < 2) return jsonResponse({ error: "Enter the team member name" }, 400);
  if (!email.includes("@")) return jsonResponse({ error: "Enter a valid email" }, 400);
  if (password && password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  if (siteIds.length === 0 || siteIds.some((siteId) => !uuidPattern.test(siteId))) {
    return jsonResponse({ error: "Select at least one valid site" }, 400);
  }

  const { data: sites, error: sitesError } = await admin.from("sites").select("id").eq("company_id", companyId).in("id", siteIds);
  if (sitesError) return jsonResponse({ error: errorMessage(sitesError, "Could not verify selected sites") }, 500);
  if ((sites ?? []).length !== siteIds.length) {
    return jsonResponse({ error: "All selected sites must belong to the company" }, 400);
  }

  if (requester.role === "Supervisor" && siteIds.some((siteId) => !requesterSiteIds.includes(siteId))) {
    return jsonResponse({ error: "Cleaners can only be assigned to sites supervised by you" }, 403);
  }

  const retainedSiteIds = requester.role === "Supervisor"
    ? currentSiteIds.filter((siteId) => !requesterSiteIds.includes(siteId))
    : [];
  const finalSiteIds = [...new Set([...retainedSiteIds, ...siteIds])];

  const authUpdates: { email: string; password?: string; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> } = {
    email,
    user_metadata: { full_name: fullName, role: member.role, company_id: companyId, site_ids: finalSiteIds },
    app_metadata: { role: member.role, company_id: companyId, site_ids: finalSiteIds },
  };
  if (password) {
    authUpdates.password = password;
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(memberId, authUpdates);
  if (authUpdateError) return jsonResponse({ error: errorMessage(authUpdateError, "Could not update team member login") }, 500);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, email, updated_at: new Date().toISOString() })
    .eq("id", memberId);
  if (profileError) return jsonResponse({ error: errorMessage(profileError, "Could not update team member profile") }, 500);

  let membershipDelete = admin.from("site_members").delete().eq("profile_id", memberId);
  if (requester.role === "Supervisor") {
    membershipDelete = membershipDelete.in("site_id", requesterSiteIds);
  }
  const { error: deleteMembershipError } = await membershipDelete;
  if (deleteMembershipError) return jsonResponse({ error: errorMessage(deleteMembershipError, "Could not update site access") }, 500);

  const { error: membershipError } = await admin.from("site_members").upsert(
    siteIds.map((siteId) => ({ site_id: siteId, profile_id: memberId, role: member.role })),
    { onConflict: "site_id,profile_id" },
  );
  if (membershipError) return jsonResponse({ error: errorMessage(membershipError, "Could not assign team member to selected sites") }, 500);

  const removedSiteIds = currentSiteIds.filter((siteId) => !finalSiteIds.includes(siteId));
  if (removedSiteIds.length > 0 && member.role === "Cleaner") {
    const { data: removedSiteDuties, error: removedSiteDutiesError } = await admin
      .from("cleaning_duties")
      .select("id")
      .in("site_id", removedSiteIds);
    if (removedSiteDutiesError) {
      return jsonResponse({ error: errorMessage(removedSiteDutiesError, "Could not verify removed site assignments") }, 500);
    }

    const removedDutyIds = (removedSiteDuties ?? []).map((duty) => duty.id as string);
    if (removedDutyIds.length > 0) {
      const { error: removedAssignmentsError } = await admin
        .from("duty_assignments")
        .delete()
        .eq("profile_id", memberId)
        .in("duty_id", removedDutyIds);
      if (removedAssignmentsError) {
        return jsonResponse({ error: errorMessage(removedAssignmentsError, "Could not remove duties from unassigned sites") }, 500);
      }
    }
  }

  return jsonResponse({ userId: memberId });
});
