import { dutyFormSchema, type DutyFormInput, type DutyStatus } from "@cleaning-duties/shared";
import { supabase } from "./supabase-client";
import { replaceDutyAssignments } from "./assignments-service";

export type DutyRow = {
  id: string;
  site_id: string;
  created_by: string;
  title: string;
  description: string;
  priority: "Urgent" | "High" | "Medium" | "Low" | "Periodical";
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

export type DutyItem = {
  id: string;
  siteId: string;
  createdBy: string;
  title: string;
  description: string;
  priority: DutyRow["priority"];
  status: DutyRow["status"];
  startsAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  previousDutyId: string | null;
  recurring: boolean;
  recurringRule: string | null;
  equipment: string[];
  referencePhotos: string[];
  completionPhotos: string[];
  beforePhotos: string[];
  afterPhotos: string[];
  assignedUserIds: string[];
  createdAt: string;
  updatedAt: string;
};

function mapDuty(row: DutyRow): DutyItem {
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
    equipment: row.equipment,
    referencePhotos: row.reference_photos,
    completionPhotos: row.completion_photos,
    beforePhotos: row.before_photos ?? [],
    afterPhotos: row.after_photos ?? [],
    assignedUserIds: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function attachDutyAssignments(duties: DutyItem[]) {
  const dutyIds = duties.map((duty) => duty.id);

  if (dutyIds.length === 0) {
    return duties;
  }

  const { data, error } = await supabase
    .from("duty_assignments")
    .select("duty_id, profile_id")
    .in("duty_id", dutyIds);

  if (error) {
    throw new Error(error.message);
  }

  const assignmentsByDutyId = new Map<string, string[]>();

  for (const row of data ?? []) {
    const assignment = row as { duty_id: string; profile_id: string };
    const currentAssignments = assignmentsByDutyId.get(assignment.duty_id) ?? [];
    assignmentsByDutyId.set(assignment.duty_id, [...currentAssignments, assignment.profile_id]);
  }

  return duties.map((duty) => ({
    ...duty,
    assignedUserIds: assignmentsByDutyId.get(duty.id) ?? [],
  }));
}

function parseCsvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildRecurringRule(values: { priority: DutyRow["priority"]; recurringPattern?: string; recurringInterval?: number; recurringWeekday?: number; recurringWeekdays?: number[] }) {
  if (values.priority !== "Periodical") {
    return null;
  }

  const pattern = values.recurringPattern || "daily";
  const interval = Math.max(Number(values.recurringInterval) || 1, 1);

  return JSON.stringify({ pattern, interval, weekday: values.recurringWeekday ?? 1, weekdays: values.recurringWeekdays?.length ? values.recurringWeekdays : [1] });
}

function buildSiteShiftWindow(dateValue: string, shiftStartTime: string | null, shiftEndTime: string | null) {
  if (!dateValue || !shiftStartTime || !shiftEndTime) {
    return { startsAt: null, dueDate: dateValue ? new Date(dateValue).toISOString() : null };
  }

  const [datePart] = dateValue.split("T");
  const start = new Date(`${datePart}T${shiftStartTime}`);
  const end = new Date(`${datePart}T${shiftEndTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { startsAt: null, dueDate: new Date(dateValue).toISOString() };
  }

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { startsAt: start.toISOString(), dueDate: end.toISOString() };
}

async function getSiteShift(siteId: string) {
  const { data, error } = await supabase
    .from("sites")
    .select("shift_start_time, shift_end_time")
    .eq("id", siteId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { shift_start_time: string | null; shift_end_time: string | null };
  return {
    shiftStartTime: row.shift_start_time?.slice(0, 5) ?? null,
    shiftEndTime: row.shift_end_time?.slice(0, 5) ?? null,
  };
}

async function getDutySiteId(dutyId: string) {
  const { data, error } = await supabase
    .from("cleaning_duties")
    .select("site_id")
    .eq("id", dutyId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { site_id: string }).site_id;
}

async function advanceDutySchedule(duties: DutyItem[]) {
  const now = new Date();
  let advanced = false;

  for (const duty of duties) {
    const startsAt = duty.startsAt ? new Date(duty.startsAt) : null;
    const dueDate = duty.dueDate ? new Date(duty.dueDate) : null;

    if (duty.status === "Scheduled" && startsAt && startsAt <= now && (!dueDate || dueDate > now)) {
      await updateDutyStatus(duty.id, "Pending");
      advanced = true;
      continue;
    }

    if (!dueDate || dueDate > now) {
      continue;
    }

    const canAdvance = duty.recurring
      ? !["Archived", "Missed", "Incomplete"].includes(duty.status)
      : ["Draft", "Scheduled", "Pending", "In Progress"].includes(duty.status);

    if (!canAdvance) {
      continue;
    }

    const { error } = await supabase.rpc("advance_duty_schedule", { p_duty_id: duty.id });
    if (error) {
      throw new Error(error.message);
    }
    advanced = true;
  }

  return advanced;
}

async function cleanupArchivedDutiesForSite(siteId: string) {
  const { error } = await supabase.rpc("cleanup_archived_duties_for_site", { p_site_id: siteId });

  if (error) {
    throw new Error(error.message);
  }
}

async function cleanupArchivedDutiesForProfile(profileId: string) {
  const { error } = await supabase.rpc("cleanup_archived_duties_for_profile", { p_profile_id: profileId });

  if (error) {
    throw new Error(error.message);
  }
}

async function toFormInput(siteId: string, values: DutyFormInput) {
  const parsed = dutyFormSchema.parse(values);
  const siteShift = await getSiteShift(siteId);
  const shiftWindow = buildSiteShiftWindow(parsed.dueDate || parsed.startDate || "", siteShift.shiftStartTime, siteShift.shiftEndTime);
  const recurringRule = buildRecurringRule({
    priority: parsed.priority,
    recurringPattern: parsed.recurringPattern,
    recurringInterval: parsed.recurringInterval,
    recurringWeekday: parsed.recurringWeekday,
    recurringWeekdays: parsed.recurringWeekdays,
  });

  return {
    title: parsed.title,
    description: parsed.description,
    priority: parsed.priority,
    status: parsed.status,
    startsAt: shiftWindow.startsAt,
    dueDate: shiftWindow.dueDate,
    recurring: parsed.priority === "Periodical",
    recurring_rule: recurringRule,
    equipment: parseCsvList(parsed.equipment),
    reference_photos: parseCsvList(parsed.referencePhotos),
    assignedUserIds: parsed.assignedUserIds ?? [],
  };
}

export async function listDuties(siteId: string, search = "", advanceSchedule = true) {
  if (advanceSchedule) {
    await cleanupArchivedDutiesForSite(siteId);
  }

  let query = supabase
    .from("cleaning_duties")
    .select("id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .eq("site_id", siteId);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const duties = await attachDutyAssignments((data ?? []).map((row) => mapDuty(row as DutyRow)));
  const advanced = advanceSchedule ? await advanceDutySchedule(duties) : false;

  if (advanced) {
    return listDuties(siteId, search, false);
  }

  return duties;
}

export async function listAssignedDuties(profileId: string, advanceSchedule = true) {
  if (advanceSchedule) {
    await cleanupArchivedDutiesForProfile(profileId);
  }

  const { data, error } = await supabase
    .from("duty_assignments")
    .select(
      "profile_id, cleaning_duties(id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at)",
    )
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  const duties = (data ?? [])
    .map((row) => (row as unknown as { cleaning_duties: DutyRow | null }).cleaning_duties)
    .filter((row): row is DutyRow => row !== null)
    .map((row) => ({ ...mapDuty(row), assignedUserIds: [profileId] }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const advanced = advanceSchedule ? await advanceDutySchedule(duties) : false;

  if (advanced) {
    return listAssignedDuties(profileId, false);
  }

  return duties;
}

export async function createDuty(siteId: string, createdBy: string, values: DutyFormInput) {
  return createDutyWithOptions(siteId, createdBy, values);
}

export async function createDraftDuty(siteId: string, createdBy: string, values: DutyFormInput) {
  return createDutyWithOptions(siteId, createdBy, values, { draft: true });
}

async function createDutyWithOptions(siteId: string, createdBy: string, values: DutyFormInput, options: { draft?: boolean } = {}) {
  const payload = await toFormInput(siteId, values);
  const now = new Date();
  const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
  const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  const status: DutyStatus = options.draft ? "Draft" : dueDate && dueDate <= now
    ? "Missed"
    : startsAt && startsAt <= now
      ? "Pending"
      : "Scheduled";
  const { data, error } = await supabase
    .from("cleaning_duties")
    .insert({
      site_id: siteId,
      created_by: createdBy,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status,
      starts_at: payload.startsAt,
      due_date: payload.dueDate,
      recurring: payload.recurring,
      recurring_rule: payload.recurring_rule,
      equipment: payload.equipment,
      reference_photos: payload.reference_photos,
    })
    .select("id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const duty = mapDuty(data as DutyRow);
  await replaceDutyAssignments(duty.id, siteId, payload.assignedUserIds, createdBy);
  return { ...duty, assignedUserIds: payload.assignedUserIds };
}

export async function updateDuty(dutyId: string, assignedBy: string, values: DutyFormInput) {
  return updateDutyWithOptions(dutyId, assignedBy, values);
}

export async function updateDraftDuty(dutyId: string, assignedBy: string, values: DutyFormInput) {
  return updateDutyWithOptions(dutyId, assignedBy, values, { draft: true });
}

async function updateDutyWithOptions(dutyId: string, assignedBy: string, values: DutyFormInput, options: { draft?: boolean } = {}) {
  const siteId = await getDutySiteId(dutyId);
  const payload = await toFormInput(siteId, values);
  const now = new Date();
  const startsAt = payload.startsAt ? new Date(payload.startsAt) : null;
  const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  const status: DutyStatus = options.draft ? "Draft" : dueDate && dueDate <= now
    ? "Missed"
    : startsAt && startsAt <= now
      ? "Pending"
      : "Scheduled";
  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status,
      starts_at: payload.startsAt,
      due_date: payload.dueDate,
      recurring: payload.recurring,
      recurring_rule: payload.recurring_rule,
      equipment: payload.equipment,
      reference_photos: payload.reference_photos,
    })
    .eq("id", dutyId)
    .select("id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const duty = mapDuty(data as DutyRow);
  await replaceDutyAssignments(duty.id, duty.siteId, payload.assignedUserIds, assignedBy);
  return { ...duty, assignedUserIds: payload.assignedUserIds };
}

export async function updateDutyStatus(dutyId: string, status: DutyRow["status"]) {
  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", dutyId)
    .select("id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDuty(data as DutyRow);
}

export async function replaceDutyEvidencePhotos(params: {
  dutyId: string;
  beforePhotos: string[];
  afterPhotos: string[];
}) {
  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({ before_photos: params.beforePhotos, after_photos: params.afterPhotos, updated_at: new Date().toISOString() })
    .eq("id", params.dutyId)
    .select("id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, previous_duty_id, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapDuty(data as DutyRow);
}

export async function addDutyComment(params: {
  dutyId: string;
  profileId: string;
  body: string;
}) {
  const body = params.body.trim();

  if (!body) {
    return;
  }

  const { error } = await supabase
    .from("duty_comments")
    .insert({
      duty_id: params.dutyId,
      profile_id: params.profileId,
      body,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteDuty(dutyId: string) {
  const { data, error } = await supabase.from("cleaning_duties").delete().eq("id", dutyId).select("id").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Duty was not deleted. Check that your account has manager permissions for this site.");
  }
}
