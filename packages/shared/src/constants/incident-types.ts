export const INCIDENT_TYPES = [
  "Broken Equipment",
  "Customer Complaint",
  "Chemical Spill",
  "Broken Glass",
  "Maintenance Required",
  "Other",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];
