import { supabase } from "./supabase-client";
import { apiUrl } from "./api-client";

export type SiteMemberRow = {
  profile_id: string;
  role: "Owner" | "Manager" | "Cleaner";
  profiles: {
    id: string;
    full_name: string;
    phone: string | null;
    role: "Owner" | "Manager" | "Cleaner";
  } | null;
};

export type AssigneeOption = {
  id: string;
  name: string;
  role: "Owner" | "Manager" | "Cleaner";
};

export async function listAssignableMembers(siteId: string) {
  const { data, error } = await supabase
    .from("site_members")
    .select("profile_id, role, profiles(id, full_name, phone, role)")
    .eq("site_id", siteId)
    .in("role", ["Owner", "Manager", "Cleaner"]);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row as unknown as SiteMemberRow)
    .filter((row) => row.profiles !== null)
    .map((row) => ({
      id: row.profile_id,
      name: row.profiles?.full_name ?? "Unknown",
      role: row.role,
    }));
}

export async function listDutyAssignments(dutyId: string) {
  const { data, error } = await supabase
    .from("duty_assignments")
    .select("profile_id, profiles(id, full_name, role)")
    .eq("duty_id", dutyId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    name: ((row as unknown as { profiles: { full_name: string } | null }).profiles?.full_name ?? "Unknown"),
  }));
}

export async function replaceDutyAssignments(dutyId: string, siteId: string, assignedUserIds: string[], assignedBy: string) {
  const uniqueAssignedUserIds = Array.from(new Set(assignedUserIds));
  const { error: deleteError } = await supabase.from("duty_assignments").delete().eq("duty_id", dutyId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (uniqueAssignedUserIds.length === 0) {
    return;
  }

  const { data: insertedAssignments, error: insertError } = await supabase
    .from("duty_assignments")
    .insert(
      uniqueAssignedUserIds.map((profileId) => ({
        duty_id: dutyId,
        profile_id: profileId,
        assigned_by: assignedBy,
      })),
    )
    .select("profile_id");

  if (insertError) {
    throw new Error(insertError.message);
  }

  if ((insertedAssignments ?? []).length !== uniqueAssignedUserIds.length) {
    throw new Error("Duty assignments were not saved. Check manager permissions for this site.");
  }

  const response = await fetch(apiUrl("/duty-notifications/assignments"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dutyId,
      siteId,
      assignedUserIds: uniqueAssignedUserIds,
      assignedBy,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn("Duty notification request failed", text);
  }
}
