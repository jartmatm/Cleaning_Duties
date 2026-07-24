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
  due_date: string | null;
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
  dueDate: string | null;
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
    dueDate: row.due_date,
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

type RecurringRule = {
  pattern: string;
  interval: number;
  weekday: number;
  weekdays: number[];
};

function parseRecurringRule(rule: string | null): RecurringRule {
  if (!rule) {
    return { pattern: "daily", interval: 1, weekday: 1, weekdays: [1] };
  }

  try {
    const parsed = JSON.parse(rule) as Partial<RecurringRule>;
    const weekday = Number.isInteger(parsed.weekday) ? parsed.weekday ?? 1 : 1;
    return {
      pattern: parsed.pattern || "daily",
      interval: Math.max(Number(parsed.interval) || 1, 1),
      weekday,
      weekdays: Array.isArray(parsed.weekdays) && parsed.weekdays.length > 0 ? parsed.weekdays.map(Number) : [weekday],
    };
  } catch {
    return { pattern: "daily", interval: 1, weekday: 1, weekdays: [1] };
  }
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const originalDate = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== originalDate) {
    next.setDate(0);
  }
  return next;
}

function nextWeeklyDate(afterDate: Date, weekdays: number[]) {
  const selectedWeekdays = [...new Set(weekdays)].sort((a, b) => a - b);
  for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
    const next = new Date(afterDate);
    next.setDate(afterDate.getDate() + dayOffset);
    if (selectedWeekdays.includes(next.getDay())) {
      return next;
    }
  }
  const fallback = new Date(afterDate);
  fallback.setDate(afterDate.getDate() + 7);
  return fallback;
}

function getNextRecurringDueDate(dueDate: string | null, rule: string | null) {
  if (!dueDate) {
    return null;
  }

  const currentDueDate = new Date(dueDate);
  if (Number.isNaN(currentDueDate.getTime())) {
    return null;
  }

  const recurringRule = parseRecurringRule(rule);
  if (recurringRule.pattern === "daily") {
    const next = new Date(currentDueDate);
    next.setDate(currentDueDate.getDate() + 1);
    return next;
  }
  if (recurringRule.pattern === "weekly") {
    return nextWeeklyDate(currentDueDate, recurringRule.weekdays);
  }
  if (recurringRule.pattern === "monthly") {
    return addMonths(currentDueDate, 1);
  }
  return addMonths(currentDueDate, 12);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

async function advanceDutySchedule(duties: DutyItem[]) {
  const now = new Date();
  const advancedDutyIds = new Set<string>();

  for (const duty of duties) {
    if (!duty.dueDate || duty.status === "Archived" || duty.status === "Missed") {
      continue;
    }

    if (!duty.recurring) {
      const missedAt = addDays(new Date(duty.dueDate), 30);
      if (now >= missedAt && duty.status !== "Completed") {
        await supabase
          .from("cleaning_duties")
          .update({ status: "Missed", updated_at: now.toISOString() })
          .eq("id", duty.id);
        advancedDutyIds.add(duty.id);
      }
      continue;
    }

    const nextDueDate = getNextRecurringDueDate(duty.dueDate, duty.recurringRule);
    if (!nextDueDate || now < nextDueDate) {
      continue;
    }

    const nextStatus: DutyStatus = duty.status === "Completed" ? "Archived" : "Missed";
    await supabase
      .from("cleaning_duties")
      .update({ status: nextStatus, updated_at: now.toISOString() })
      .eq("id", duty.id);

    const { data: createdDuty, error: createError } = await supabase
      .from("cleaning_duties")
      .insert({
        site_id: duty.siteId,
        created_by: duty.createdBy,
        title: duty.title,
        description: duty.description,
        priority: duty.priority,
        status: "Pending",
        due_date: nextDueDate.toISOString(),
        recurring: true,
        recurring_rule: duty.recurringRule,
        equipment: duty.equipment,
        reference_photos: duty.referencePhotos,
      })
      .select("id")
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    const newDutyId = (createdDuty as { id: string }).id;
    await replaceDutyAssignments(newDutyId, duty.siteId, duty.assignedUserIds, duty.createdBy);
    advancedDutyIds.add(duty.id);
  }

  return advancedDutyIds.size > 0;
}

function toFormInput(values: DutyFormInput) {
  const parsed = dutyFormSchema.parse(values);
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
    dueDate: parsed.dueDate ? new Date(parsed.dueDate).toISOString() : null,
    recurring: parsed.priority === "Periodical",
    recurring_rule: recurringRule,
    equipment: parseCsvList(parsed.equipment),
    reference_photos: parseCsvList(parsed.referencePhotos),
    assignedUserIds: parsed.assignedUserIds ?? [],
  };
}

export async function listDuties(siteId: string, search = "", advanceSchedule = true) {
  let query = supabase
    .from("cleaning_duties")
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
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
  const { data, error } = await supabase
    .from("duty_assignments")
    .select(
      "profile_id, cleaning_duties(id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at)",
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
  const payload = toFormInput(values);
  const { data, error } = await supabase
    .from("cleaning_duties")
    .insert({
      site_id: siteId,
      created_by: createdBy,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: payload.status,
      due_date: payload.dueDate,
      recurring: payload.recurring,
      recurring_rule: payload.recurring_rule,
      equipment: payload.equipment,
      reference_photos: payload.reference_photos,
    })
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const duty = mapDuty(data as DutyRow);
  await replaceDutyAssignments(duty.id, siteId, payload.assignedUserIds, createdBy);
  return { ...duty, assignedUserIds: payload.assignedUserIds };
}

export async function updateDuty(dutyId: string, values: DutyFormInput) {
  const payload = toFormInput(values);
  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: payload.status,
      due_date: payload.dueDate,
      recurring: payload.recurring,
      recurring_rule: payload.recurring_rule,
      equipment: payload.equipment,
      reference_photos: payload.reference_photos,
    })
    .eq("id", dutyId)
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const duty = mapDuty(data as DutyRow);
  await replaceDutyAssignments(duty.id, duty.siteId, payload.assignedUserIds, duty.createdBy);
  return { ...duty, assignedUserIds: payload.assignedUserIds };
}

export async function updateDutyStatus(dutyId: string, status: DutyRow["status"]) {
  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", dutyId)
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
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
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
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
