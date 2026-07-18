import { Router } from "express";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

export const inviteRouter = Router();

inviteRouter.post("/", async (req, res) => {
  const { email, password, role = "Cleaner", company_id, site_ids = [] } = req.body as {
    email?: string;
    password?: string;
    role?: "Owner" | "Manager" | "Cleaner";
    company_id?: string;
    site_ids?: string[];
  };

  if (!email) return res.status(400).json({ error: "email is required" });
  if (!password) return res.status(400).json({ error: "password is required" });
  if (!company_id) return res.status(400).json({ error: "company_id is required" });

  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, company_id, site_ids },
      user_metadata: { full_name: role, role, company_id, site_ids },
    });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ data });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});
