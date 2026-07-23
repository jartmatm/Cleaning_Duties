import { siteFormSchema, type SiteFormInput } from "@cleaning-duties/shared";
import { supabase } from "./supabase-client";

export type SiteRow = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  notes: string;
  info_photos: string[];
  storage_bucket: string;
  created_at: string;
  updated_at: string;
};

export type SiteItem = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  notes: string;
  infoPhotos: string[];
  storageBucket: string;
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
    infoPhotos: row.info_photos ?? [],
    storageBucket: row.storage_bucket || `site-${row.id}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSites(companyId: string, search = "") {
  let query = supabase.from("sites").select("id, company_id, name, address, notes, info_photos, storage_bucket, created_at, updated_at").eq("company_id", companyId);

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapSite(row as SiteRow));
}

export async function listMySites(profileId: string, search = "") {
  let query = supabase
    .from("site_members")
    .select("sites(id, company_id, name, address, notes, info_photos, storage_bucket, created_at, updated_at)")
    .eq("profile_id", profileId);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const normalizedSearch = search.trim().toLowerCase();

  return (data ?? [])
    .map((row) => (row as unknown as { sites: SiteRow | null }).sites)
    .filter((site): site is SiteRow => site !== null)
    .filter((site) => !normalizedSearch || site.name.toLowerCase().includes(normalizedSearch))
    .map(mapSite)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    .select("id, company_id, name, address, notes, info_photos, storage_bucket, created_at, updated_at")
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
    .select("id, company_id, name, address, notes, info_photos, storage_bucket, created_at, updated_at")
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

function fileExtension(fileName: string) {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function updateSiteInformation(siteId: string, input: { notes: string; infoPhotos: string[] }) {
  const { data, error } = await supabase
    .from("sites")
    .update({
      notes: input.notes,
      info_photos: input.infoPhotos,
      updated_at: new Date().toISOString(),
    })
    .eq("id", siteId)
    .select("id, company_id, name, address, notes, info_photos, storage_bucket, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSite(data as SiteRow);
}

export async function uploadSiteInfoPhoto(params: { bucketName: string; siteId: string; file: File }) {
  const fileName = `site-info-${crypto.randomUUID()}.${fileExtension(params.file.name)}`;
  const storagePath = `${safeSegment(params.siteId)}/site-info/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from(params.bucketName).upload(storagePath, params.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: params.file.type || "image/jpeg",
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(params.bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
}
