import { dutyFormSchema, type DutyFormInput } from "@cleaning-duties/shared";
import { supabase } from "./supabase-client";
import { replaceDutyAssignments } from "./assignments-service";

export type DutyRow = {
  id: string;
  site_id: string;
  created_by: string;
  title: string;
  description: string;
  priority: "Urgent" | "High" | "Medium" | "Low" | "Periodical";
  status: "Draft" | "Pending" | "In Progress" | "Completed" | "Incomplete" | "Overdue";
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

function toFormInput(values: DutyFormInput) {
  const parsed = dutyFormSchema.parse(values);

  return {
    title: parsed.title,
    description: parsed.description,
    priority: parsed.priority,
    status: parsed.status,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate).toISOString() : null,
    equipment: parseCsvList(parsed.equipment),
    reference_photos: parseCsvList(parsed.referencePhotos),
    assignedUserIds: parsed.assignedUserIds ?? [],
  };
}

export async function listDuties(siteId: string, search = "") {
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

  return attachDutyAssignments((data ?? []).map((row) => mapDuty(row as DutyRow)));
}

export async function listAssignedDuties(profileId: string) {
  const { data, error } = await supabase
    .from("duty_assignments")
    .select(
      "profile_id, cleaning_duties(id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at)",
    )
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => (row as unknown as { cleaning_duties: DutyRow | null }).cleaning_duties)
    .filter((row): row is DutyRow => row !== null)
    .map((row) => ({ ...mapDuty(row), assignedUserIds: [profileId] }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

export async function appendDutyEvidencePhotos(params: {
  dutyId: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
}) {
  const { data: current, error: currentError } = await supabase
    .from("cleaning_duties")
    .select("before_photos, after_photos")
    .eq("id", params.dutyId)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const beforePhotos = [...((current as { before_photos: string[] | null }).before_photos ?? []), ...(params.beforePhotos ?? [])];
  const afterPhotos = [...((current as { after_photos: string[] | null }).after_photos ?? []), ...(params.afterPhotos ?? [])];

  const { data, error } = await supabase
    .from("cleaning_duties")
    .update({ before_photos: beforePhotos, after_photos: afterPhotos, updated_at: new Date().toISOString() })
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
