import { dutyFormSchema, type DutyFormInput } from "@cleaning-duties/shared";
import { supabase } from "./supabase-client";

export type PreloadedDutyRow = {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string;
  priority: "Urgent" | "High" | "Medium" | "Low" | "Periodical";
  status: "Draft" | "Pending" | "In Progress" | "Completed" | "Incomplete" | "Overdue";
  equipment: string[];
  reference_photos: string[];
  created_at: string;
  updated_at: string;
};

export type PreloadedDutyItem = {
  id: string;
  companyId: string;
  createdBy: string;
  title: string;
  description: string;
  priority: PreloadedDutyRow["priority"];
  status: PreloadedDutyRow["status"];
  equipment: string[];
  referencePhotos: string[];
  createdAt: string;
  updatedAt: string;
};

function mapPreloadedDuty(row: PreloadedDutyRow): PreloadedDutyItem {
  return {
    id: row.id,
    companyId: row.company_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    equipment: row.equipment ?? [],
    referencePhotos: row.reference_photos ?? [],
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

function toPayload(values: DutyFormInput) {
  const parsed = dutyFormSchema.parse(values);

  return {
    title: parsed.title,
    description: parsed.description,
    priority: parsed.priority,
    status: parsed.status,
    equipment: parseCsvList(parsed.equipment),
    reference_photos: parseCsvList(parsed.referencePhotos),
  };
}

const PRELOADED_DUTY_SELECT = "id, company_id, created_by, title, description, priority, status, equipment, reference_photos, created_at, updated_at";

export async function listPreloadedDuties(companyId: string, search = "") {
  let query = supabase
    .from("preloaded_duties")
    .select(PRELOADED_DUTY_SELECT)
    .eq("company_id", companyId);

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, error } = await query.order("title", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapPreloadedDuty(row as PreloadedDutyRow));
}

export async function createPreloadedDuty(companyId: string, createdBy: string, values: DutyFormInput) {
  const payload = toPayload(values);
  const { data, error } = await supabase
    .from("preloaded_duties")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      ...payload,
    })
    .select(PRELOADED_DUTY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPreloadedDuty(data as PreloadedDutyRow);
}

export async function updatePreloadedDuty(templateId: string, values: DutyFormInput) {
  const payload = toPayload(values);
  const { data, error } = await supabase
    .from("preloaded_duties")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select(PRELOADED_DUTY_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPreloadedDuty(data as PreloadedDutyRow);
}

export async function deletePreloadedDuty(templateId: string) {
  const { error } = await supabase.from("preloaded_duties").delete().eq("id", templateId);

  if (error) {
    throw new Error(error.message);
  }
}
