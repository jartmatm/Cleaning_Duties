import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (request.method !== "POST") {
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
    full_name?: string;
    email?: string;
    password?: string;
    role?: "Owner" | "Manager" | "Cleaner";
    company_id?: string;
    site_ids?: string[];
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const fullName = payload.full_name?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const role = payload.role ?? "Cleaner";
  const companyId = payload.company_id ?? "";
  const siteIds = Array.isArray(payload.site_ids) ? [...new Set(payload.site_ids)] : [];

  if (fullName.length < 2) return jsonResponse({ error: "Enter the cleaner name" }, 400);
  if (!email.includes("@")) return jsonResponse({ error: "Enter a valid email" }, 400);
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  if (!uuidPattern.test(companyId)) return jsonResponse({ error: "A valid company is required" }, 400);
  if (role !== "Cleaner") return jsonResponse({ error: "Only cleaner invitations are supported" }, 400);
  if (siteIds.length === 0 || siteIds.some((siteId) => !uuidPattern.test(siteId))) {
    return jsonResponse({ error: "Select at least one valid site" }, 400);
  }

  const { data: requester, error: requesterError } = await admin
    .from("profiles")
    .select("company_id, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError) {
    return jsonResponse({ error: errorMessage(requesterError, "Could not verify your profile") }, 500);
  }
  if (!requester || requester.company_id !== companyId || !["Owner", "Manager"].includes(requester.role)) {
    return jsonResponse({ error: "You are not allowed to invite users to this company" }, 403);
  }

  const { data: company, error: companyError } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (companyError) return jsonResponse({ error: errorMessage(companyError, "Could not verify company") }, 500);
  if (!company) return jsonResponse({ error: "Company not found" }, 404);

  const { data: sites, error: sitesError } = await admin.from("sites").select("id").eq("company_id", companyId).in("id", siteIds);
  if (sitesError) return jsonResponse({ error: errorMessage(sitesError, "Could not verify selected sites") }, 500);
  if ((sites ?? []).length !== siteIds.length) {
    return jsonResponse({ error: "All selected sites must belong to the company" }, 400);
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, company_id: companyId, site_ids: siteIds },
    user_metadata: { full_name: fullName, role, company_id: companyId, site_ids: siteIds },
  });

  if (createUserError || !createdUser.user) {
    return jsonResponse({ error: errorMessage(createUserError, "Could not create auth user") }, 400);
  }

  const userId = createdUser.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    company_id: companyId,
    full_name: fullName,
    email,
    phone: null,
    role,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return jsonResponse({ error: errorMessage(profileError, "Could not create cleaner profile") }, 500);
  }

  const { error: membershipError } = await admin.from("site_members").upsert(
    siteIds.map((siteId) => ({ site_id: siteId, profile_id: userId, role })),
    { onConflict: "site_id,profile_id" },
  );

  if (membershipError) {
    await admin.auth.admin.deleteUser(userId);
    return jsonResponse({ error: errorMessage(membershipError, "Could not assign cleaner to selected sites") }, 500);
  }

  return jsonResponse({ userId }, 201);
});
