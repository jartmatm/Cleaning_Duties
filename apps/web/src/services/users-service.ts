import { supabase } from "./supabase-client";

export type CompanyUserRole = "Owner" | "Manager" | "Cleaner";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
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
  email: string | null;
  phone: string | null;
  role: CompanyUserRole;
  status: "Active";
  siteIds: string[];
  siteNames: string[];
  createdAt: string;
};

export async function listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, created_at")
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
  const siteIdsByProfileId = new Map<string, string[]>();
  for (const membership of (memberships ?? []) as unknown as SiteMemberRow[]) {
    if (!membership.sites) {
      continue;
    }

    const current = siteNamesByProfileId.get(membership.profile_id) ?? [];
    siteNamesByProfileId.set(membership.profile_id, [...current, membership.sites.name]);
    const currentIds = siteIdsByProfileId.get(membership.profile_id) ?? [];
    siteIdsByProfileId.set(membership.profile_id, [...currentIds, membership.sites.id]);
  }

  return profileRows.map((profile) => ({
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    status: "Active",
    siteIds: siteIdsByProfileId.get(profile.id) ?? [],
    siteNames: (siteNamesByProfileId.get(profile.id) ?? []).sort((a, b) => a.localeCompare(b)),
    createdAt: profile.created_at,
  }));
}

async function cleanerErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error && (error as { context?: unknown }).context instanceof Response) {
    const response = (error as { context: Response }).context;
    try {
      const body = await response.clone().json() as { error?: unknown; message?: unknown };
      const message = body.error ?? body.message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      const message = await response.clone().text();
      if (message.trim()) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "The cleaner could not be updated.";
}

export async function updateCleaner(input: { cleanerId: string; companyId: string; fullName: string; email: string; password?: string; siteIds: string[] }) {
  const { data, error } = await supabase.functions.invoke("manage-cleaner", {
    method: "PATCH",
    body: {
      cleaner_id: input.cleanerId,
      company_id: input.companyId,
      full_name: input.fullName,
      email: input.email,
      password: input.password || undefined,
      site_ids: input.siteIds,
    },
  });

  if (error) {
    throw new Error(await cleanerErrorMessage(error));
  }

  return data as { userId: string };
}

export async function deleteCleaner(input: { cleanerId: string; companyId: string }) {
  const { error } = await supabase.functions.invoke("manage-cleaner", {
    method: "DELETE",
    body: {
      cleaner_id: input.cleanerId,
      company_id: input.companyId,
    },
  });

  if (error) {
    throw new Error(await cleanerErrorMessage(error));
  }
}
