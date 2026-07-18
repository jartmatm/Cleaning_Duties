import { supabase } from "./supabase-client";

export type CompanyUserRole = "Owner" | "Manager" | "Cleaner";

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: CompanyUserRole;
  created_at: string;
};

type SiteMemberRow = {
  profile_id: string;
  sites: {
    id: string;
    name: string;
  } | null;
};

export type CompanyUser = {
  id: string;
  name: string;
  phone: string | null;
  role: CompanyUserRole;
  status: "Active";
  siteNames: string[];
  createdAt: string;
};

export async function listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("company_id", companyId)
    .eq("role", "Cleaner")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileRows = (profiles ?? []) as ProfileRow[];
  const profileIds = profileRows.map((profile) => profile.id);

  if (profileIds.length === 0) {
    return [];
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("site_members")
    .select("profile_id, sites(id, name)")
    .in("profile_id", profileIds);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const siteNamesByProfileId = new Map<string, string[]>();
  for (const membership of (memberships ?? []) as unknown as SiteMemberRow[]) {
    if (!membership.sites) {
      continue;
    }

    const current = siteNamesByProfileId.get(membership.profile_id) ?? [];
    siteNamesByProfileId.set(membership.profile_id, [...current, membership.sites.name]);
  }

  return profileRows.map((profile) => ({
    id: profile.id,
    name: profile.full_name,
    phone: profile.phone,
    role: profile.role,
    status: "Active",
    siteNames: (siteNamesByProfileId.get(profile.id) ?? []).sort((a, b) => a.localeCompare(b)),
    createdAt: profile.created_at,
  }));
}
