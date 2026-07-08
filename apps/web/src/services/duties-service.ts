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
    assignedUserIds: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, created_at, updated_at")
    .eq("site_id", siteId);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapDuty(row as DutyRow));
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
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const duty = mapDuty(data as DutyRow);
  await replaceDutyAssignments(duty.id, payload.assignedUserIds, createdBy);
  return duty;
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
    .select("id, site_id, created_by, title, description, priority, status, due_date, recurring, recurring_rule, equipment, reference_photos, completion_photos, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const duty = mapDuty(data as DutyRow);
  await replaceDutyAssignments(duty.id, payload.assignedUserIds, duty.createdBy);
  return duty;
}

export async function deleteDuty(dutyId: string) {
  const { error } = await supabase.from("cleaning_duties").delete().eq("id", dutyId);

  if (error) {
    throw new Error(error.message);
  }
}
