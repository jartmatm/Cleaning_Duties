import { Router } from "express";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

export const inviteRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    const details = (error as { details?: unknown }).details;
    if (typeof details === "string" && details.trim()) {
      return details;
    }
  }
  return fallback;
}

inviteRouter.post("/", async (req, res) => {
  const { email, password, role = "Cleaner", company_id, site_ids = [] } = req.body as {
    email?: string;
    password?: string;
    role?: "Supervisor" | "Cleaner";
    company_id?: string;
    site_ids?: string[];
    full_name?: string;
  };
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";

  if (!fullName) return res.status(400).json({ error: "full_name is required" });
  if (fullName.length < 2) return res.status(400).json({ error: "full_name must be at least 2 characters" });
  if (!email) return res.status(400).json({ error: "email is required" });
  if (!password) return res.status(400).json({ error: "password is required" });
  if (!company_id) return res.status(400).json({ error: "company_id is required" });
  if (!uuidPattern.test(company_id)) return res.status(400).json({ error: "company_id must be a valid UUID" });
  if (!Array.isArray(site_ids)) return res.status(400).json({ error: "site_ids must be an array" });
  if (!["Supervisor", "Cleaner"].includes(role)) return res.status(400).json({ error: "role must be Supervisor or Cleaner" });

  const uniqueSiteIds = [...new Set(site_ids)];
  const invalidSiteId = uniqueSiteIds.find((siteId) => !uuidPattern.test(siteId));
  if (invalidSiteId) return res.status(400).json({ error: "site_ids must contain only valid UUIDs" });

  try {
    const supabase = createSupabaseAdminClient();
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });

    const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice("Bearer ".length));
    if (authError || !authData.user) return res.status(401).json({ error: "Your session is no longer valid" });

    const { data: requester, error: requesterError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("id", authData.user.id)
      .maybeSingle<{ company_id: string; role: "Manager" | "Supervisor" | "Cleaner" }>();
    if (requesterError) return res.status(500).json({ error: errorMessage(requesterError, "Could not verify your profile") });
    if (!requester || requester.company_id !== company_id || !["Manager", "Supervisor"].includes(requester.role)) {
      return res.status(403).json({ error: "You are not allowed to invite users to this company" });
    }
    if (requester.role === "Supervisor" && role !== "Cleaner") {
      return res.status(403).json({ error: "Supervisors can only create cleaner accounts" });
    }

    const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", company_id).maybeSingle();
    if (companyError) return res.status(500).json({ error: errorMessage(companyError, "Could not verify company") });
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (uniqueSiteIds.length > 0) {
      const { data: sites, error: sitesError } = await supabase.from("sites").select("id").eq("company_id", company_id).in("id", uniqueSiteIds);
      if (sitesError) return res.status(500).json({ error: errorMessage(sitesError, "Could not verify selected sites") });

      if ((sites ?? []).length !== uniqueSiteIds.length) {
        return res.status(400).json({ error: "All selected sites must belong to the company" });
      }

      if (requester.role === "Supervisor") {
        const { data: allowedSites, error: allowedSitesError } = await supabase
          .from("site_members")
          .select("site_id")
          .eq("profile_id", authData.user.id)
          .in("site_id", uniqueSiteIds);
        if (allowedSitesError) return res.status(500).json({ error: errorMessage(allowedSitesError, "Could not verify supervisor site access") });
        if ((allowedSites ?? []).length !== uniqueSiteIds.length) {
          return res.status(403).json({ error: "Cleaners can only be assigned to sites supervised by you" });
        }
      }
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, company_id, site_ids: uniqueSiteIds },
      user_metadata: { full_name: fullName, role, company_id, site_ids: uniqueSiteIds },
    });

    if (error) return res.status(500).json({ error: errorMessage(error, "Could not create auth user") });
    if (!data.user) return res.status(500).json({ error: "Supabase did not return the created user" });

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      company_id,
      full_name: fullName,
      phone: null,
      role,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return res.status(500).json({ error: errorMessage(profileError, "Could not create cleaner profile") });

    if (uniqueSiteIds.length > 0) {
      const { error: membershipError } = await supabase.from("site_members").upsert(
        uniqueSiteIds.map((site_id) => ({
          site_id,
          profile_id: data.user.id,
          role,
        })),
        { onConflict: "site_id,profile_id" },
      );
      if (membershipError) return res.status(500).json({ error: errorMessage(membershipError, "Could not assign cleaner to selected sites") });
    }

    return res.json({ data });
  } catch (err: unknown) {
    return res.status(500).json({ error: errorMessage(err, "Invite failed unexpectedly") });
  }
});
