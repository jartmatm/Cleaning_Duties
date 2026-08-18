import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.1";
import { mergeSheetHistory, type HistoricalSheet, type SheetCell } from "./sheet-history.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SPREADSHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;
const SHEET_WRITE_BATCH_SIZE = 500;
const DEFAULT_APP_URL = "https://cleaningduties.app";
const DEFAULT_TIME_ZONE = "Australia/Melbourne";

type ExportFormat = "google_sheets" | "csv" | "json";
type ExportPeriodicity = "daily" | "weekly" | "monthly" | "custom";

type ExportSettings = {
  company_id: string;
  enabled: boolean;
  format: ExportFormat;
  periodicity: ExportPeriodicity;
  interval_days: number;
  schedule_started_at: string;
  next_run_at: string | null;
  google_email: string | null;
  google_file_id: string | null;
  google_file_url: string | null;
  google_file_mime_type: string | null;
  connected_at: string | null;
  last_exported_at: string | null;
  last_export_status: "idle" | "running" | "success" | "failed";
  last_export_error: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
};

type SiteRow = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  notes: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  updated_at: string;
};

type SiteMemberRow = {
  site_id: string;
  profile_id: string;
  role: string;
  created_at: string;
};

type DutyRow = {
  id: string;
  site_id: string;
  created_by: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  starts_at: string | null;
  due_date: string | null;
  completed_at: string | null;
  recurring: boolean;
  recurring_rule: string | null;
  equipment: string[] | null;
  reference_photos: string[] | null;
  completion_photos: string[] | null;
  before_photos: string[] | null;
  after_photos: string[] | null;
  created_at: string;
  updated_at: string;
};

type DutyAssignmentRow = {
  duty_id: string;
  profile_id: string;
  assigned_by: string;
  assigned_at: string;
  completed_at: string | null;
};

type IncidentRow = {
  id: string;
  duty_id: string | null;
  site_id: string;
  reported_by: string;
  incident_type: string;
  details: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type ExportData = {
  generatedAt: string;
  company: CompanyRow;
  duties: Record<string, unknown>[];
  incidents: Record<string, unknown>[];
  sites: Record<string, unknown>[];
  team: Record<string, unknown>[];
  dailyPerformance: Record<string, unknown>[];
};

type SheetData = HistoricalSheet;

type GoogleTokenInfo = {
  aud?: string;
  scope?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function fetchAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createStateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getGoogleConfig() {
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google Drive OAuth is not configured yet.");
  }
  return { clientId, clientSecret };
}

function allowedReturnUrl(value: unknown) {
  const fallback = new URL("/settings", Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).toString();
  if (typeof value !== "string" || !value.trim()) return fallback;

  try {
    const requested = new URL(value);
    const productionOrigin = new URL(Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).origin;
    const isLocal = requested.hostname === "localhost" || requested.hostname === "127.0.0.1";
    if (requested.origin !== productionOrigin && !isLocal) return fallback;
    return new URL("/settings", requested.origin).toString();
  } catch {
    return fallback;
  }
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function getGoogleTokenInfo(accessToken: string) {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!response.ok) return null;
    return await response.json() as GoogleTokenInfo;
  } catch {
    return null;
  }
}

function hasGoogleExportScope(tokenInfo: GoogleTokenInfo) {
  const scopes = new Set((tokenInfo.scope ?? "").split(/\s+/).filter(Boolean));
  return scopes.has(DRIVE_FILE_SCOPE) || scopes.has(DRIVE_SCOPE) || scopes.has(SPREADSHEETS_SCOPE);
}

async function googleAuthorizationSummary(accessToken: string) {
  const clientId = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") ?? "";
  const expectedProjectNumber = clientId.split("-")[0] || "unknown";
  const tokenInfo = await getGoogleTokenInfo(accessToken);
  if (!tokenInfo) return `OAuth project number: ${expectedProjectNumber}; token details unavailable`;
  const scopes = new Set((tokenInfo.scope ?? "").split(/\s+/).filter(Boolean));
  return [
    `OAuth project number: ${expectedProjectNumber}`,
    `token audience matches client: ${Boolean(clientId && tokenInfo.aud === clientId)}`,
    `drive.file granted: ${scopes.has(DRIVE_FILE_SCOPE)}`,
  ].join("; ");
}

async function revokeGoogleToken(token: string) {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => null);
}

async function ensureCronGatewayKey(admin: SupabaseClient) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("Supabase anon key is unavailable");
  const { error } = await admin.rpc("store_data_export_anon_key", { p_anon_key: anonKey });
  if (error) throw error;
}

async function requireManager(request: Request, admin: SupabaseClient) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required");

  const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice("Bearer ".length));
  if (authError || !authData.user) throw new Error("Your session is no longer valid");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "Manager") throw new Error("Only the company manager can manage data exports");

  return { userId: authData.user.id, companyId: profile.company_id as string };
}

async function googleRequest<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const googleError = body && typeof body === "object" && "error" in body ? JSON.stringify(body.error) : text;
    if (response.status === 403 && url.startsWith(SHEETS_URL)) {
      const authorizationSummary = await googleAuthorizationSummary(accessToken);
      throw new Error(
        `Google Sheets denied the request. Enable the Google Sheets API in the OAuth client project and confirm the connected account can create spreadsheets. ${authorizationSummary}. Google response: ${googleError || response.statusText}`,
      );
    }
    throw new Error(`Google API request failed (${response.status}): ${googleError || response.statusText}`);
  }
  return body as T;
}

async function getAccessToken(admin: SupabaseClient, companyId: string) {
  const { data: refreshToken, error: refreshError } = await admin.rpc("get_company_google_refresh_token", {
    p_company_id: companyId,
  });
  if (refreshError) throw refreshError;
  if (typeof refreshToken !== "string" || !refreshToken) throw new Error("Google Drive is not connected");

  const google = getGoogleConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: google.clientId,
      client_secret: google.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error(payload.error_description ?? "Google could not refresh the Drive connection");
  }
  return { accessToken: payload.access_token as string, refreshToken };
}

function localDateKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const valueByPart = new Map(parts.map((part) => [part.type, part.value]));
    return `${valueByPart.get("year")}-${valueByPart.get("month")}-${valueByPart.get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function collectExportData(admin: SupabaseClient, companyId: string): Promise<ExportData> {
  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .single();
  if (companyError) throw companyError;

  const sites = await fetchAllRows<SiteRow>((from, to) => admin
    .from("sites")
    .select("id, company_id, name, address, notes, shift_start_time, shift_end_time, created_at, updated_at")
    .eq("company_id", companyId)
    .order("id")
    .range(from, to));
  const profiles = await fetchAllRows<ProfileRow>((from, to) => admin
    .from("profiles")
    .select("id, company_id, full_name, email, phone, role, created_at, updated_at")
    .eq("company_id", companyId)
    .order("id")
    .range(from, to));

  const siteIds = sites.map((site) => site.id);
  const siteMembers: SiteMemberRow[] = [];
  const duties: DutyRow[] = [];
  const incidents: IncidentRow[] = [];
  for (const siteIdBatch of chunks(siteIds, ID_BATCH_SIZE)) {
    siteMembers.push(...await fetchAllRows<SiteMemberRow>((from, to) => admin
      .from("site_members")
      .select("site_id, profile_id, role, created_at")
      .in("site_id", siteIdBatch)
      .order("id")
      .range(from, to)));
    duties.push(...await fetchAllRows<DutyRow>((from, to) => admin
      .from("cleaning_duties")
      .select("id, site_id, created_by, title, description, priority, status, starts_at, due_date, completed_at, recurring, recurring_rule, equipment, reference_photos, completion_photos, before_photos, after_photos, created_at, updated_at")
      .in("site_id", siteIdBatch)
      .order("id")
      .range(from, to)));
    incidents.push(...await fetchAllRows<IncidentRow>((from, to) => admin
      .from("incidents")
      .select("id, duty_id, site_id, reported_by, incident_type, details, resolved_at, created_at, updated_at")
      .in("site_id", siteIdBatch)
      .order("id")
      .range(from, to)));
  }

  const assignments: DutyAssignmentRow[] = [];
  for (const dutyIdBatch of chunks(duties.map((duty) => duty.id), ID_BATCH_SIZE)) {
    assignments.push(...await fetchAllRows<DutyAssignmentRow>((from, to) => admin
      .from("duty_assignments")
      .select("duty_id, profile_id, assigned_by, assigned_at, completed_at")
      .in("duty_id", dutyIdBatch)
      .order("id")
      .range(from, to)));
  }

  const siteById = new Map(sites.map((site) => [site.id, site]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const assignmentsByDuty = new Map<string, DutyAssignmentRow[]>();
  for (const assignment of assignments) {
    assignmentsByDuty.set(assignment.duty_id, [...(assignmentsByDuty.get(assignment.duty_id) ?? []), assignment]);
  }
  const sitesByProfile = new Map<string, string[]>();
  for (const member of siteMembers) {
    const siteName = siteById.get(member.site_id)?.name ?? member.site_id;
    sitesByProfile.set(member.profile_id, [...(sitesByProfile.get(member.profile_id) ?? []), siteName]);
  }

  const dutyRows = duties.map((duty) => {
    const site = siteById.get(duty.site_id);
    const dutyAssignments = assignmentsByDuty.get(duty.id) ?? [];
    return {
      duty_id: duty.id,
      company: company.name,
      site_id: duty.site_id,
      site: site?.name ?? "",
      title: duty.title,
      description: duty.description,
      priority: duty.priority,
      status: duty.status,
      execution_date: localDateKey(duty.starts_at ?? duty.due_date ?? duty.created_at),
      shift_started_at: duty.starts_at,
      shift_ended_at: duty.due_date,
      completed_at: duty.completed_at,
      recurring: duty.recurring,
      recurring_rule: duty.recurring_rule,
      equipment: (duty.equipment ?? []).join(", "),
      assigned_cleaners: dutyAssignments.map((assignment) => profileById.get(assignment.profile_id)?.full_name ?? assignment.profile_id).join(", "),
      assigned_cleaner_emails: dutyAssignments.map((assignment) => profileById.get(assignment.profile_id)?.email ?? "").filter(Boolean).join(", "),
      created_by: profileById.get(duty.created_by)?.full_name ?? duty.created_by,
      reference_media_count: duty.reference_photos?.length ?? 0,
      before_media_count: duty.before_photos?.length ?? 0,
      after_media_count: duty.after_photos?.length ?? 0,
      completion_media_count: duty.completion_photos?.length ?? 0,
      created_at: duty.created_at,
      updated_at: duty.updated_at,
    };
  });

  const incidentRows = incidents.map((incident) => ({
    incident_id: incident.id,
    company: company.name,
    site_id: incident.site_id,
    site: siteById.get(incident.site_id)?.name ?? "",
    duty_id: incident.duty_id,
    type: incident.incident_type,
    details: incident.details,
    reported_by: profileById.get(incident.reported_by)?.full_name ?? incident.reported_by,
    reporter_email: profileById.get(incident.reported_by)?.email ?? "",
    status: incident.resolved_at ? "Resolved" : "Open",
    resolved_at: incident.resolved_at,
    created_at: incident.created_at,
    updated_at: incident.updated_at,
  }));

  const siteRows = sites.map((site) => ({
    site_id: site.id,
    company: company.name,
    name: site.name,
    address: site.address,
    notes: site.notes,
    timezone: DEFAULT_TIME_ZONE,
    shift_start_time: site.shift_start_time,
    shift_end_time: site.shift_end_time,
    team_members: siteMembers.filter((member) => member.site_id === site.id).length,
    created_at: site.created_at,
    updated_at: site.updated_at,
  }));

  const teamRows = profiles.map((profile) => ({
    profile_id: profile.id,
    company: company.name,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    sites: (sitesByProfile.get(profile.id) ?? []).join(", "),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }));

  const performance = new Map<string, { date: string; site: string; total: number; completed: number; missed: number; incomplete: number }>();
  for (const duty of dutyRows) {
    const date = String(duty.execution_date);
    const site = String(duty.site);
    const key = `${date}\u0000${site}`;
    const row = performance.get(key) ?? { date, site, total: 0, completed: 0, missed: 0, incomplete: 0 };
    row.total += 1;
    if (["Completed", "Archived"].includes(String(duty.status))) row.completed += 1;
    if (duty.status === "Missed") row.missed += 1;
    if (duty.status === "Incomplete") row.incomplete += 1;
    performance.set(key, row);
  }
  const dailyPerformance = [...performance.values()]
    .sort((left, right) => left.date.localeCompare(right.date) || left.site.localeCompare(right.site))
    .map((row) => ({
      date: row.date,
      company: company.name,
      site: row.site,
      total_duties: row.total,
      completed_duties: row.completed,
      missed_duties: row.missed,
      incomplete_duties: row.incomplete,
      completion_rate: row.total ? Number(((row.completed / row.total) * 100).toFixed(2)) : 0,
    }));

  return {
    generatedAt: new Date().toISOString(),
    company: company as CompanyRow,
    duties: dutyRows,
    incidents: incidentRows,
    sites: siteRows,
    team: teamRows,
    dailyPerformance,
  };
}

function scalarValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function rowsForSheet(title: string, rows: Record<string, unknown>[], fallbackHeaders: string[], keyHeaders: string[]): SheetData {
  const headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders;
  return {
    title,
    headers,
    rows: rows.map((row) => headers.map((header) => scalarValue(row[header]))),
    keyHeaders,
  };
}

function buildSheets(data: ExportData) {
  return [
    rowsForSheet("Duties", data.duties, ["duty_id", "company", "site", "title", "status", "execution_date"], ["duty_id"]),
    rowsForSheet("Incidents", data.incidents, ["incident_id", "company", "site", "type", "status", "created_at"], ["incident_id"]),
    rowsForSheet("Sites", data.sites, ["site_id", "company", "name", "address", "timezone"], ["site_id"]),
    rowsForSheet("Team", data.team, ["profile_id", "company", "name", "email", "role", "sites"], ["profile_id"]),
    rowsForSheet("Daily Performance", data.dailyPerformance, ["date", "company", "site", "total_duties", "completed_duties", "completion_rate"], ["date", "site"]),
  ];
}

function escapedSheetRange(title: string) {
  return `'${title.replaceAll("'", "''")}'`;
}

async function createSpreadsheet(accessToken: string, companyName: string, sheets: SheetData[]) {
  return googleRequest<{ spreadsheetId: string; spreadsheetUrl: string }>(`${SHEETS_URL}?fields=spreadsheetId,spreadsheetUrl`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: `Cleaning Duties - ${companyName} - Analytics` },
      sheets: sheets.map((sheet) => ({ properties: { title: sheet.title, gridProperties: { frozenRowCount: 1 } } })),
    }),
  });
}

async function updateSpreadsheet(accessToken: string, spreadsheetId: string, sheets: SheetData[]) {
  const metadata = await googleRequest<{ sheets?: Array<{ properties: { title: string } }> }>(
    `${SHEETS_URL}/${spreadsheetId}?fields=sheets.properties.title`,
    accessToken,
  );
  const existingTitles = new Set((metadata.sheets ?? []).map((sheet) => sheet.properties.title));
  const missingSheets = sheets.filter((sheet) => !existingTitles.has(sheet.title));
  if (missingSheets.length) {
    await googleRequest(`${SHEETS_URL}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: missingSheets.map((sheet) => ({
          addSheet: { properties: { title: sheet.title, gridProperties: { frozenRowCount: 1 } } },
        })),
      }),
    });
  }

  for (const sheet of sheets) {
    const encodedSheet = encodeURIComponent(escapedSheetRange(sheet.title));
    const existing = await googleRequest<{ values?: SheetCell[][] }>(
      `${SHEETS_URL}/${spreadsheetId}/values/${encodedSheet}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
      accessToken,
    );
    const merged = mergeSheetHistory(sheet, existing.values ?? []);
    const values: SheetCell[][] = [merged.headers, ...merged.rows];
    for (let index = 0; index < values.length; index += SHEET_WRITE_BATCH_SIZE) {
      const range = `${escapedSheetRange(sheet.title)}!A${index + 1}`;
      await googleRequest(
        `${SHEETS_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        accessToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ range, majorDimension: "ROWS", values: values.slice(index, index + SHEET_WRITE_BATCH_SIZE) }),
        },
      );
    }
  }
}

function csvValue(value: unknown) {
  const normalized = scalarValue(value);
  const text = String(normalized);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["duty_id", "company", "site", "title", "status", "execution_date"];
  return [headers.map(csvValue).join(","), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))].join("\r\n");
}

async function createDriveFile(accessToken: string, name: string, mimeType: string) {
  return googleRequest<{ id: string; webViewLink?: string }>(`${DRIVE_FILES_URL}?fields=id,webViewLink`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType, description: "Automatically updated by Cleaning Duties" }),
  });
}

async function uploadDriveFile(accessToken: string, fileId: string, mimeType: string, content: string) {
  return googleRequest<{ id: string; webViewLink?: string }>(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,webViewLink`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": `${mimeType}; charset=utf-8` },
      body: content,
    },
  );
}

function nextRunAt(settings: ExportSettings) {
  const next = new Date();
  if (settings.periodicity === "monthly") {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  } else {
    const days = settings.periodicity === "weekly"
      ? 7
      : settings.periodicity === "custom"
        ? Math.min(Math.max(settings.interval_days || 1, 1), 999)
        : 1;
    next.setUTCDate(next.getUTCDate() + days);
  }
  return next.toISOString();
}

async function exportCompany(admin: SupabaseClient, companyId: string) {
  const { data: settingsData, error: settingsError } = await admin
    .from("company_data_exports")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settingsData?.connected_at) throw new Error("Google Drive is not connected");
  const settings = settingsData as ExportSettings;

  await admin.from("company_data_exports").update({
    last_export_status: "running",
    last_export_error: null,
    updated_at: new Date().toISOString(),
  }).eq("company_id", companyId);

  try {
    const [{ accessToken }, exportData] = await Promise.all([
      getAccessToken(admin, companyId),
      collectExportData(admin, companyId),
    ]);
    const expectedMimeType = settings.format === "google_sheets"
      ? "application/vnd.google-apps.spreadsheet"
      : settings.format === "csv"
        ? "text/csv"
        : "application/json";
    const canReuseFile = Boolean(settings.google_file_id && settings.google_file_mime_type === expectedMimeType);
    let fileId = canReuseFile ? settings.google_file_id as string : "";
    let fileUrl = canReuseFile ? settings.google_file_url : null;

    if (settings.format === "google_sheets") {
      const sheets = buildSheets(exportData);
      if (!fileId) {
        const created = await createSpreadsheet(accessToken, exportData.company.name, sheets);
        fileId = created.spreadsheetId;
        fileUrl = created.spreadsheetUrl;
      }
      try {
        await updateSpreadsheet(accessToken, fileId, sheets);
      } catch (error) {
        if (!canReuseFile || !errorMessage(error, "").includes("(404)")) throw error;
        const created = await createSpreadsheet(accessToken, exportData.company.name, sheets);
        fileId = created.spreadsheetId;
        fileUrl = created.spreadsheetUrl;
        await updateSpreadsheet(accessToken, fileId, sheets);
      }
      fileUrl = fileUrl ?? `https://docs.google.com/spreadsheets/d/${fileId}`;
    } else {
      const extension = settings.format === "csv" ? "csv" : "json";
      const content = settings.format === "csv" ? `\uFEFF${buildCsv(exportData.duties)}` : JSON.stringify(exportData, null, 2);
      if (!fileId) {
        const created = await createDriveFile(
          accessToken,
          `Cleaning Duties - ${exportData.company.name} - Analytics.${extension}`,
          expectedMimeType,
        );
        fileId = created.id;
        fileUrl = created.webViewLink ?? null;
      }
      let uploaded;
      try {
        uploaded = await uploadDriveFile(accessToken, fileId, expectedMimeType, content);
      } catch (error) {
        if (!canReuseFile || !errorMessage(error, "").includes("(404)")) throw error;
        const recreated = await createDriveFile(
          accessToken,
          `Cleaning Duties - ${exportData.company.name} - Analytics.${extension}`,
          expectedMimeType,
        );
        fileId = recreated.id;
        fileUrl = recreated.webViewLink ?? null;
        uploaded = await uploadDriveFile(accessToken, fileId, expectedMimeType, content);
      }
      fileUrl = uploaded.webViewLink ?? fileUrl ?? `https://drive.google.com/file/d/${fileId}/view`;
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await admin.from("company_data_exports").update({
      google_file_id: fileId,
      google_file_url: fileUrl,
      google_file_mime_type: expectedMimeType,
      last_exported_at: completedAt,
      last_export_status: "success",
      last_export_error: null,
      next_run_at: settings.enabled ? nextRunAt(settings) : null,
      updated_at: completedAt,
    }).eq("company_id", companyId);
    if (updateError) throw updateError;

    return { fileId, fileUrl, exportedAt: completedAt };
  } catch (error) {
    const message = errorMessage(error, "Data export failed").slice(0, 1000);
    await admin.from("company_data_exports").update({
      last_export_status: "failed",
      last_export_error: message,
      next_run_at: settings.enabled ? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("company_id", companyId);
    throw error;
  }
}

async function authorizeGoogle(request: Request, admin: SupabaseClient, body: Record<string, unknown>) {
  const manager = await requireManager(request, admin);
  const google = getGoogleConfig();
  const state = createStateToken();
  const stateHash = await sha256(state);
  const settingsUrl = allowedReturnUrl(body.returnUrl);
  const callbackUrl = new URL("/google-drive-callback.html", settingsUrl).toString();

  await ensureCronGatewayKey(admin);

  await admin.from("google_drive_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error: stateError } = await admin.from("google_drive_oauth_states").insert({
    state_hash: stateHash,
    company_id: manager.companyId,
    profile_id: manager.userId,
    return_url: callbackUrl,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateError) throw stateError;

  const { data: existingSettings, error: settingsError } = await admin
    .from("company_data_exports")
    .select("company_id")
    .eq("company_id", manager.companyId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!existingSettings) {
    const { error: insertError } = await admin.from("company_data_exports").insert({ company_id: manager.companyId });
    if (insertError) throw insertError;
  }

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: `openid email ${DRIVE_FILE_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();

  return jsonResponse({ url: authorizationUrl.toString() });
}

async function completeGoogleOAuth(request: Request, admin: SupabaseClient, body: Record<string, unknown>) {
  const manager = await requireManager(request, admin);
  const state = typeof body.state === "string" ? body.state : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!state || !code) throw new Error("Google authorization response is incomplete");

  const stateHash = await sha256(state);
  const { data: oauthState, error: stateError } = await admin
    .from("google_drive_oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .eq("company_id", manager.companyId)
    .eq("profile_id", manager.userId)
    .gt("expires_at", new Date().toISOString())
    .select("company_id, profile_id, return_url")
    .maybeSingle();
  if (stateError) throw stateError;
  if (!oauthState) throw new Error("Google authorization expired. Start the connection again.");

  const google = getGoogleConfig();
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: oauthState.return_url,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string") {
    throw new Error(tokens.error_description ?? "Google did not return a renewable Drive connection");
  }

  const tokenInfo = await getGoogleTokenInfo(tokens.access_token);
  if (tokenInfo && !hasGoogleExportScope(tokenInfo)) {
    await revokeGoogleToken(tokens.refresh_token);
    throw new Error(
      `Google did not grant Drive file access. Add ${DRIVE_FILE_SCOPE} in Google Auth Platform > Data Access, then reconnect.`,
    );
  }

  const userInfo = await googleRequest<{ email?: string }>("https://openidconnect.googleapis.com/v1/userinfo", tokens.access_token);
  const { error: tokenError } = await admin.rpc("store_company_google_refresh_token", {
    p_company_id: oauthState.company_id,
    p_refresh_token: tokens.refresh_token,
  });
  if (tokenError) throw tokenError;

  const connectedAt = new Date().toISOString();
  const { error: updateError } = await admin.from("company_data_exports").update({
    google_email: userInfo.email ?? null,
    connected_at: connectedAt,
    last_export_status: "idle",
    last_export_error: null,
    updated_at: connectedAt,
  }).eq("company_id", oauthState.company_id);
  if (updateError) throw updateError;

  try {
    await exportCompany(admin, oauthState.company_id);
    return jsonResponse({ ok: true, initialSyncFailed: false });
  } catch (syncError) {
    console.error("Initial Google Drive export failed", { companyId: oauthState.company_id, error: errorMessage(syncError, "Unknown error") });
    return jsonResponse({ ok: true, initialSyncFailed: true });
  }
}

async function disconnectGoogle(request: Request, admin: SupabaseClient) {
  const manager = await requireManager(request, admin);
  const { data: refreshToken } = await admin.rpc("get_company_google_refresh_token", { p_company_id: manager.companyId });
  if (typeof refreshToken === "string" && refreshToken) {
    await revokeGoogleToken(refreshToken);
  }

  const { error: deleteError } = await admin.rpc("delete_company_google_refresh_token", { p_company_id: manager.companyId });
  if (deleteError) throw deleteError;
  const { error: updateError } = await admin.from("company_data_exports").update({
    enabled: false,
    next_run_at: null,
    google_email: null,
    connected_at: null,
    last_export_status: "idle",
    last_export_error: null,
    updated_at: new Date().toISOString(),
  }).eq("company_id", manager.companyId);
  if (updateError) throw updateError;
  return jsonResponse({ ok: true });
}

async function syncNow(request: Request, admin: SupabaseClient) {
  const manager = await requireManager(request, admin);
  const result = await exportCompany(admin, manager.companyId);
  return jsonResponse({ ok: true, ...result });
}

async function runDueExports(admin: SupabaseClient, body: Record<string, unknown>) {
  const suppliedSecret = typeof body.cronSecret === "string" ? body.cronSecret : "";
  const { data: expectedSecret, error: secretError } = await admin.rpc("get_data_export_cron_secret");
  if (secretError) throw secretError;
  if (typeof expectedSecret !== "string" || !constantTimeEqual(suppliedSecret, expectedSecret)) {
    return jsonResponse({ error: "Invalid cron credentials" }, 401);
  }

  const { data: dueSettings, error: dueError } = await admin
    .from("company_data_exports")
    .select("company_id")
    .eq("enabled", true)
    .not("connected_at", "is", null)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at")
    .limit(5);
  if (dueError) throw dueError;

  const results: Array<{ companyId: string; ok: boolean; error?: string }> = [];
  for (const settings of dueSettings ?? []) {
    try {
      await exportCompany(admin, settings.company_id);
      results.push({ companyId: settings.company_id, ok: true });
    } catch (error) {
      results.push({ companyId: settings.company_id, ok: false, error: errorMessage(error, "Export failed") });
    }
  }
  return jsonResponse({ ok: true, processed: results.length, results });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase function credentials are unavailable" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const requestUrl = new URL(request.url);
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json() as Record<string, unknown>;
    switch (body.action) {
      case "authorize":
        return await authorizeGoogle(request, admin, body);
      case "complete_oauth":
        return await completeGoogleOAuth(request, admin, body);
      case "sync_now":
        return await syncNow(request, admin);
      case "disconnect":
        return await disconnectGoogle(request, admin);
      case "run_due":
        return await runDueExports(admin, body);
      default:
        return jsonResponse({ error: "Unsupported action" }, 400);
    }
  } catch (error) {
    const message = errorMessage(error, "Data export request failed");
    const status = message.includes("Authentication") || message.includes("session") ? 401
      : message.includes("Only the company manager") ? 403
      : message.includes("not configured") ? 503
      : 500;
    console.error("google-drive-export", { path: requestUrl.pathname, error: message });
    return jsonResponse({ error: message }, status);
  }
});
