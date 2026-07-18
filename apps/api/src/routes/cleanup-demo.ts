import { Router } from "express";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

export const cleanupDemoRouter = Router();

// Removes demo companies (by name match) and associated auth users.
cleanupDemoRouter.post("/", async (_req, res) => {
  try {
    const supabase = createSupabaseAdminClient();

    // Find demo companies by name (North Tower or containing 'demo')
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id,name")
      .or("name.ilike.%north tower%,name.ilike.%demo%");

    if (compErr) return res.status(500).json({ error: compErr.message });
    if (!companies || companies.length === 0) return res.json({ deleted: [] });

    const companyIds = companies.map((c: any) => c.id);

    // Find profile ids for those companies
    const { data: profiles } = await supabase.from("profiles").select("id").in("company_id", companyIds as any);
    const profileIds = (profiles ?? []).map((p: any) => p.id);

    // Delete auth users for those profiles (this will cascade-delete profiles)
    for (const id of profileIds) {
      try {
        await supabase.auth.admin.deleteUser(id);
      } catch (e) {
        // continue on individual delete errors
      }
    }

    // Delete companies (will cascade-delete sites, duties, etc.)
    const { error: delErr } = await supabase.from("companies").delete().in("id", companyIds as any);
    if (delErr) return res.status(500).json({ error: delErr.message });

    return res.json({ deleted_companies: companyIds, deleted_profiles: profileIds });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});
