import type { DutyStatus, UserRole } from "@cleaning-duties/shared";
import { supabase } from "@/lib/supabase";
import type { Duty, DutyComment, DutyDetail, Incident } from "@/types/domain";
import { mapIncidentRow, type IncidentRow } from "./incidents-service";

type DutyRow = {
  id: string;
  site_id: string;
  created_by: string;
  title: string;
  description: string;
  priority: Duty["priority"];
  status: DutyStatus;
  starts_at: string | null;
  due_date: string | null;
  completed_at: string | null;
  previous_duty_id: string | null;
  recurring: boolean;
  recurring_rule: string | null;
  equipment: string[];
  reference_photos: string[];
  completion_photos: string[];
  before_photos: string[];
  after_photos: string[];
  created_at: string;
  updated_at: string;
};

const DUTY_SELECT = "id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at";

function mapDuty(row: DutyRow): Duty {
  return {
    id: row.id,
    siteId: row.site_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    startsAt: row.starts_at,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    previousDutyId: row.previous_duty_id,
    recurring: row.recurring,
    recurringRule: row.recurring_rule,
    equipment: row.equipment ?? [],
    referencePhotos: row.reference_photos ?? [],
    completionPhotos: row.completion_photos ?? [],
    beforePhotos: row.before_photos ?? [],
    afterPhotos: row.after_photos ?? [],
    assignedUserIds: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachAssignments(duties: Duty[]) {
  if (duties.length === 0) return duties;
  const { data, error } = await supabase
    .from("duty_assignments")
    .select("duty_id, profile_id")
    .in("duty_id", duties.map((duty) => duty.id));
  if (error) throw new Error(error.message);

  const assignments = new Map<string, string[]>();
  for (const row of data ?? []) {
    const item = row as { duty_id: string; profile_id: string };
    assignments.set(item.duty_id, [...(assignments.get(item.duty_id) ?? []), item.profile_id]);
  }
  return duties.map((duty) => ({ ...duty, assignedUserIds: assignments.get(duty.id) ?? [] }));
}

async function advanceSchedules(duties: Duty[]) {
  const now = Date.now();
  let changed = false;
  for (const duty of duties) {
    const startsAt = duty.startsAt ? new Date(duty.startsAt).getTime() : null;
    const dueDate = duty.dueDate ? new Date(duty.dueDate).getTime() : null;
    const shouldAdvanceScheduled = duty.status === "Scheduled" && startsAt !== null && startsAt <= now;
    const shouldCloseShift = dueDate !== null && dueDate <= now && !["Archived", "Missed", "Incomplete"].includes(duty.status);
    if (!shouldAdvanceScheduled && !shouldCloseShift) continue;
    const { error } = await supabase.rpc("advance_duty_schedule", { p_duty_id: duty.id });
    if (error) throw new Error(error.message);
    changed = true;
  }
  return changed;
}

export async function listDuties(input: { siteId: string; profileId: string; role: UserRole }, advance = true): Promise<Duty[]> {
  if (advance) {
    const rpcName = input.role === "Cleaner" ? "cleanup_archived_duties_for_profile" : "cleanup_archived_duties_for_site";
    const rpcArgs = input.role === "Cleaner" ? { p_profile_id: input.profileId } : { p_site_id: input.siteId };
    const { error } = await supabase.rpc(rpcName, rpcArgs);
    if (error) throw new Error(error.message);
  }

  let duties: Duty[];
  if (input.role === "Cleaner") {
    const { data, error } = await supabase
      .from("duty_assignments")
      .select(`profile_id, cleaning_duties(${DUTY_SELECT})`)
      .eq("profile_id", input.profileId);
    if (error) throw new Error(error.message);
    duties = (data ?? [])
      .map((row) => (row as unknown as { cleaning_duties: DutyRow | null }).cleaning_duties)
      .filter((row): row is DutyRow => row !== null && row.site_id === input.siteId)
      .map((row) => ({ ...mapDuty(row), assignedUserIds: [input.profileId] }));
  } else {
    const { data, error } = await supabase
      .from("cleaning_duties")
      .select(DUTY_SELECT)
      .eq("site_id", input.siteId)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    duties = await attachAssignments((data ?? []).map((row) => mapDuty(row as DutyRow)));
  }

  const ordered = duties.sort((a, b) => new Date(b.startsAt ?? b.createdAt).getTime() - new Date(a.startsAt ?? a.createdAt).getTime());
  if (advance && await advanceSchedules(ordered)) {
    return listDuties(input, false);
  }
  return ordered;
}

export async function getDutyDetail(dutyId: string): Promise<DutyDetail> {
  const { data, error } = await supabase.from("cleaning_duties").select(DUTY_SELECT).eq("id", dutyId).single();
  if (error) throw new Error(error.message);

  const [assignmentResult, commentResult, incidentResult] = await Promise.all([
    supabase.from("duty_assignments").select("profile_id, profiles(full_name)").eq("duty_id", dutyId),
    supabase.from("duty_comments").select("id, profile_id, body, created_at, profiles(full_name)").eq("duty_id", dutyId).order("created_at", { ascending: true }),
    supabase.from("incidents").select("id, duty_id, site_id, reported_by, incident_type, details, resolved_at, created_at, updated_at").eq("duty_id", dutyId).order("created_at", { ascending: false }),
  ]);
  if (assignmentResult.error) throw new Error(assignmentResult.error.message);
  if (commentResult.error) throw new Error(commentResult.error.message);
  if (incidentResult.error) throw new Error(incidentResult.error.message);

  const assignedUsers = (assignmentResult.data ?? []).map((row) => {
    const item = row as unknown as { profile_id: string; profiles: { full_name: string } | null };
    return { id: item.profile_id, name: item.profiles?.full_name ?? "Cleaner" };
  });
  const comments: DutyComment[] = (commentResult.data ?? []).map((row) => {
    const item = row as unknown as { id: string; profile_id: string; body: string; created_at: string; profiles: { full_name: string } | null };
    return { id: item.id, profileId: item.profile_id, authorName: item.profiles?.full_name ?? "Team member", body: item.body, createdAt: item.created_at };
  });
  const incidents: Incident[] = (incidentResult.data ?? []).map((row) => mapIncidentRow(row as IncidentRow));
  const duty = mapDuty(data as DutyRow);
  return { ...duty, assignedUserIds: assignedUsers.map((user) => user.id), assignedUsers, comments, incidents };
}

export async function transitionDuty(duty: Duty, nextStatus: "In Progress" | "Completed", role: UserRole) {
  if (role === "Cleaner") {
    const allowed = (duty.status === "Pending" && nextStatus === "In Progress")
      || (duty.status === "In Progress" && nextStatus === "Completed");
    if (!allowed) throw new Error(`This duty cannot move from ${duty.status} to ${nextStatus}.`);
  }
  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", duty.id)
    .eq("status", duty.status)
    .select(DUTY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapDuty(data as DutyRow);
}

export async function saveDutyEvidence(dutyId: string, beforePhotos: string[], afterPhotos: string[]) {
  const { error } = await supabase
    .from("cleaning_duties")
    .update({ before_photos: beforePhotos, after_photos: afterPhotos, updated_at: new Date().toISOString() })
    .eq("id", dutyId);
  if (error) throw new Error(error.message);
}

export async function addDutyComment(dutyId: string, profileId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("duty_comments").insert({ duty_id: dutyId, profile_id: profileId, body: trimmed });
  if (error) throw new Error(error.message);
}
