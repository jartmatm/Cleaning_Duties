import type { IncidentType } from "@cleaning-duties/shared";
import { supabase } from "./supabase-client";

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

export type IncidentItem = {
  id: string;
  dutyId: string | null;
  siteId: string;
  reportedBy: string;
  incidentType: IncidentType;
  details: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateIncidentInput = {
  siteId: string;
  reportedBy: string;
  incidentType: IncidentType;
  dutyId?: string | null;
  occurredAt: string;
  location: string;
  summary: string;
  immediateAction: string;
  injuryOrDamage: string;
};

function mapIncident(row: IncidentRow): IncidentItem {
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

function formatIncidentDetails(input: CreateIncidentInput) {
  return [
    `Occurred at: ${input.occurredAt}`,
    `Location/area: ${input.location}`,
    `What happened: ${input.summary}`,
    `Immediate action taken: ${input.immediateAction}`,
    `Injury or damage: ${input.injuryOrDamage}`,
  ].join("\n");
}

export async function listIncidentsForReporter(profileId: string) {
  const { data, error } = await supabase
    .from("incidents")
    .select("id, duty_id, site_id, reported_by, incident_type, details, resolved_at, created_at, updated_at")
    .eq("reported_by", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapIncident(row as IncidentRow));
}

export async function createIncident(input: CreateIncidentInput) {
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      duty_id: input.dutyId ?? null,
      site_id: input.siteId,
      reported_by: input.reportedBy,
      incident_type: input.incidentType,
      details: formatIncidentDetails(input),
    })
    .select("id, duty_id, site_id, reported_by, incident_type, details, resolved_at, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapIncident(data as IncidentRow);
}
