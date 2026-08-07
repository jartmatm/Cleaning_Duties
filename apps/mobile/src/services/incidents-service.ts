import type { IncidentType } from "@cleaning-duties/shared";
import { supabase } from "@/lib/supabase";
import type { Incident } from "@/types/domain";

export type IncidentRow = {
  id: string;
  duty_id: string | null;
  site_id: string;
  reported_by: string;
  incident_type: IncidentType;
  details: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapIncidentRow(row: IncidentRow): Incident {
  return {
    id: row.id,
    dutyId: row.duty_id,
    siteId: row.site_id,
    reportedBy: row.reported_by,
    incidentType: row.incident_type,
    details: row.details,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listIncidents(input: { siteId: string; profileId: string; cleanerOnly: boolean }) {
  let query = supabase
    .from("incidents")
    .select("id, duty_id, site_id, reported_by, incident_type, details, resolved_at, created_at, updated_at")
    .eq("site_id", input.siteId);
  if (input.cleanerOnly) query = query.eq("reported_by", input.profileId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapIncidentRow(row as IncidentRow));
}

export async function createIncident(input: {
  siteId: string;
  reportedBy: string;
  dutyId: string | null;
  incidentType: IncidentType;
  occurredAt: string;
  location: string;
  summary: string;
  immediateAction: string;
  injuryOrDamage: string;
}) {
  const details = [
    `Occurred at: ${input.occurredAt}`,
    `Location/area: ${input.location.trim()}`,
    `What happened: ${input.summary.trim()}`,
    `Immediate action taken: ${input.immediateAction.trim()}`,
    `Injury or damage: ${input.injuryOrDamage.trim()}`,
  ].join("\n");
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      duty_id: input.dutyId,
      site_id: input.siteId,
      reported_by: input.reportedBy,
      incident_type: input.incidentType,
      details,
    })
    .select("id, duty_id, site_id, reported_by, incident_type, details, resolved_at, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return mapIncidentRow(data as IncidentRow);
}
