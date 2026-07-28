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

  const cleanerId = payload.cleaner_id ?? "";
  const companyId = payload.company_id ?? "";

  if (!uuidPattern.test(cleanerId)) return jsonResponse({ error: "A valid cleaner is required" }, 400);
  if (!uuidPattern.test(companyId)) return jsonResponse({ error: "A valid company is required" }, 400);

  const { data: requester, error: requesterError } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError) {
    return jsonResponse({ error: errorMessage(requesterError, "Could not verify your profile") }, 500);
  }
  if (!requester || requester.company_id !== companyId || !["Owner", "Manager"].includes(requester.role)) {
    return jsonResponse({ error: "You are not allowed to manage cleaners for this company" }, 403);
  }

  const { data: cleaner, error: cleanerError } = await admin
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", cleanerId)
    .maybeSingle();

  if (cleanerError) return jsonResponse({ error: errorMessage(cleanerError, "Could not verify cleaner") }, 500);
  if (!cleaner || cleaner.company_id !== companyId || cleaner.role !== "Cleaner") {
    return jsonResponse({ error: "Cleaner not found in this company" }, 404);
  }

  if (request.method === "DELETE") {
    const { error: assignmentError } = await admin.from("duty_assignments").delete().eq("profile_id", cleanerId);
    if (assignmentError) return jsonResponse({ error: errorMessage(assignmentError, "Could not remove duty assignments") }, 500);

    const { error: membershipError } = await admin.from("site_members").delete().eq("profile_id", cleanerId);
    if (membershipError) return jsonResponse({ error: errorMessage(membershipError, "Could not remove site access") }, 500);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(cleanerId);
    if (deleteUserError) return jsonResponse({ error: errorMessage(deleteUserError, "Could not delete cleaner account") }, 500);

    return jsonResponse({ userId: cleanerId });
  }

  const fullName = payload.full_name?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const siteIds = Array.isArray(payload.site_ids) ? [...new Set(payload.site_ids)] : [];

  if (fullName.length < 2) return jsonResponse({ error: "Enter the cleaner name" }, 400);
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

  const authUpdates: { email: string; password?: string; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> } = {
    email,
    user_metadata: { full_name: fullName, role: "Cleaner", company_id: companyId, site_ids: siteIds },
    app_metadata: { role: "Cleaner", company_id: companyId, site_ids: siteIds },
  };
  if (password) {
    authUpdates.password = password;
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(cleanerId, authUpdates);
  if (authUpdateError) return jsonResponse({ error: errorMessage(authUpdateError, "Could not update cleaner login") }, 500);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, email, updated_at: new Date().toISOString() })
    .eq("id", cleanerId);
  if (profileError) return jsonResponse({ error: errorMessage(profileError, "Could not update cleaner profile") }, 500);

  const { error: deleteMembershipError } = await admin.from("site_members").delete().eq("profile_id", cleanerId);
  if (deleteMembershipError) return jsonResponse({ error: errorMessage(deleteMembershipError, "Could not update site access") }, 500);

  const { error: membershipError } = await admin.from("site_members").upsert(
    siteIds.map((siteId) => ({ site_id: siteId, profile_id: cleanerId, role: "Cleaner" })),
    { onConflict: "site_id,profile_id" },
  );
  if (membershipError) return jsonResponse({ error: errorMessage(membershipError, "Could not assign cleaner to selected sites") }, 500);

  return jsonResponse({ userId: cleanerId });
});
