import { siteFormSchema, type SiteFormInput } from "@cleaning-duties/shared";
import { supabase } from "./supabase-client";

export type SiteRow = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type SiteItem = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

function mapSite(row: SiteRow): SiteItem {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSites(companyId: string, search = "") {
  let query = supabase.from("sites").select("id, company_id, name, address, notes, created_at, updated_at").eq("company_id", companyId);

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapSite(row as SiteRow));
}

export async function createSite(companyId: string, input: SiteFormInput) {
  const parsed = siteFormSchema.parse(input);

  const { data, error } = await supabase
    .from("sites")
    .insert({
      company_id: companyId,
      name: parsed.name,
      address: parsed.address || null,
      notes: parsed.notes,
    })
    .select("id, company_id, name, address, notes, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSite(data as SiteRow);
}

export async function updateSite(siteId: string, input: SiteFormInput) {
  const parsed = siteFormSchema.parse(input);

  const { data, error } = await supabase
    .from("sites")
    .update({
      name: parsed.name,
      address: parsed.address || null,
      notes: parsed.notes,
    })
    .eq("id", siteId)
    .select("id, company_id, name, address, notes, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSite(data as SiteRow);
}

export async function deleteSite(siteId: string) {
  const { error } = await supabase.from("sites").delete().eq("id", siteId);

  if (error) {
    throw new Error(error.message);
  }
}
