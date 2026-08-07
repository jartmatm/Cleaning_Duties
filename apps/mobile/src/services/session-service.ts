import type { UserRole } from "@cleaning-duties/shared";
import { supabase } from "@/lib/supabase";
import type { Company, Profile, Site } from "@/types/domain";

type ProfileRow = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
};

type CompanyRow = {
  id: string;
  name: string;
  logo_url: string | null;
  color_palette: string;
};

type SiteRow = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  notes: string;
  info_photos: string[];
  storage_bucket: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
};

const SITE_SELECT = "id, company_id, name, address, notes, info_photos, storage_bucket, shift_start_time, shift_end_time";

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    companyId: row.company_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  };
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    colorPalette: row.color_palette,
  };
}

function mapSite(row: SiteRow): Site {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    address: row.address,
    notes: row.notes,
    infoPhotos: row.info_photos ?? [],
    storageBucket: row.storage_bucket || `site-${row.id}`,
    shiftStartTime: row.shift_start_time?.slice(0, 5) ?? null,
    shiftEndTime: row.shift_end_time?.slice(0, 5) ?? null,
  };
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, email, phone, role")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return mapProfile(data as ProfileRow);
}

export async function getCompany(companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, logo_url, color_palette")
    .eq("id", companyId)
    .single();
  if (error) throw new Error(error.message);
  return mapCompany(data as CompanyRow);
}

export async function listAccessibleSites(profile: Profile) {
  const { data: memberships, error: membershipError } = await supabase
    .from("site_members")
    .select("site_id")
    .eq("profile_id", profile.id);
  if (membershipError) throw new Error(membershipError.message);

  let query = supabase.from("sites").select(SITE_SELECT).eq("company_id", profile.companyId);
  if (profile.role !== "Manager") {
    const siteIds = (memberships ?? []).map((row) => (row as { site_id: string }).site_id);
    if (siteIds.length === 0) return [];
    query = query.in("id", siteIds);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapSite(row as SiteRow));
}

export async function updateOwnProfile(userId: string, input: { fullName: string; phone: string }) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim(), phone: input.phone.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, company_id, full_name, email, phone, role")
    .single();
  if (error) throw new Error(error.message);
  return mapProfile(data as ProfileRow);
}
