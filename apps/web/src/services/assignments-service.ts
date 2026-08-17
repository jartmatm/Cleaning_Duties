import { supabase } from "./supabase-client";
import { emitNotificationEventSafely } from "./notification-events-service";

export type SiteMemberRow = {
  profile_id: string;
  role: "Manager" | "Supervisor" | "Cleaner";
  profiles: {
    id: string;
    full_name: string;
    phone: string | null;
    role: "Manager" | "Supervisor" | "Cleaner";
  } | null;
};

export type AssigneeOption = {
  id: string;
  name: string;
  role: "Cleaner";
};

export async function listAssignableMembers(siteId: string) {
  const { data, error } = await supabase
    .from("site_members")
    .select("profile_id, role, profiles(id, full_name, phone, role)")
    .eq("site_id", siteId)
    .eq("role", "Cleaner");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row as unknown as SiteMemberRow)
    .filter((row) => row.profiles !== null)
    .map((row) => ({
      id: row.profile_id,
      name: row.profiles?.full_name ?? "Unknown",
      role: "Cleaner" as const,
    }));
}

export async function listDutyAssignments(dutyId: string) {
  const { data, error } = await supabase
    .from("duty_assignments")
    .select("profile_id, assigned_at, completed_at, profiles(id, full_name, role)")
    .eq("duty_id", dutyId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    name: ((row as unknown as { profiles: { full_name: string } | null }).profiles?.full_name ?? "Unknown"),
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
  }));
}

export async function replaceDutyAssignments(dutyId: string, _siteId: string, assignedUserIds: string[], assignedBy: string) {
  const uniqueAssignedUserIds = Array.from(new Set(assignedUserIds));
  const { data: currentAssignments, error: currentError } = await supabase
    .from("duty_assignments")
    .select("profile_id")
    .eq("duty_id", dutyId);

  if (currentError) throw new Error(currentError.message);

  const currentIds = new Set((currentAssignments ?? []).map((assignment) => assignment.profile_id));
  const nextIds = new Set(uniqueAssignedUserIds);
  const removedIds = [...currentIds].filter((profileId) => !nextIds.has(profileId));
  const addedIds = uniqueAssignedUserIds.filter((profileId) => !currentIds.has(profileId));

  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("duty_assignments")
      .delete()
      .eq("duty_id", dutyId)
      .in("profile_id", removedIds);
    if (deleteError) throw new Error(deleteError.message);
  }

  if (addedIds.length > 0) {
    const { data: insertedAssignments, error: insertError } = await supabase
      .from("duty_assignments")
      .insert(
        addedIds.map((profileId) => ({
          duty_id: dutyId,
          profile_id: profileId,
          assigned_by: assignedBy,
        })),
      )
      .select("profile_id");

    if (insertError) throw new Error(insertError.message);
    if ((insertedAssignments ?? []).length !== addedIds.length) {
      throw new Error("Duty assignments were not saved. Check manager permissions for this site.");
    }
  }

  if (uniqueAssignedUserIds.length > 0) {
    await emitNotificationEventSafely({
      event: "duty_assigned",
      dutyId,
      assignedUserIds: uniqueAssignedUserIds,
    });
  }
}
