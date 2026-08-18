import { supabase } from "./supabase-client";

export type DataExportFormat = "google_sheets" | "csv" | "json";
export type DataExportPeriodicity = "daily" | "weekly" | "monthly" | "custom";
export type DataExportStatus = "idle" | "running" | "success" | "failed";

export type DataExportSettings = {
  companyId: string;
  enabled: boolean;
  format: DataExportFormat;
  periodicity: DataExportPeriodicity;
  intervalDays: number;
  scheduleStartedAt: string;
  nextRunAt: string | null;
  googleEmail: string | null;
  googleFileUrl: string | null;
  connectedAt: string | null;
  lastExportedAt: string | null;
  lastExportStatus: DataExportStatus;
  lastExportError: string | null;
};

type DataExportRow = {
  company_id: string;
  enabled: boolean;
  format: DataExportFormat;
  periodicity: DataExportPeriodicity;
  interval_days: number;
  schedule_started_at: string;
  next_run_at: string | null;
  google_email: string | null;
  google_file_url: string | null;
  connected_at: string | null;
  last_exported_at: string | null;
  last_export_status: DataExportStatus;
  last_export_error: string | null;
};

function mapSettings(row: DataExportRow): DataExportSettings {
  return {
    companyId: row.company_id,
    enabled: row.enabled,
    format: row.format,
    periodicity: row.periodicity,
    intervalDays: row.interval_days,
    scheduleStartedAt: row.schedule_started_at,
    nextRunAt: row.next_run_at,
    googleEmail: row.google_email,
    googleFileUrl: row.google_file_url,
    connectedAt: row.connected_at,
    lastExportedAt: row.last_exported_at,
    lastExportStatus: row.last_export_status,
    lastExportError: row.last_export_error,
  };
}

async function invokeExportFunction<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-drive-export", { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string };
        message = payload.error || message;
      } catch {
        // The SDK message is retained when the function did not return JSON.
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export async function getDataExportSettings(companyId: string) {
  const { data, error } = await supabase
    .from("company_data_exports")
    .select("company_id, enabled, format, periodicity, interval_days, schedule_started_at, next_run_at, google_email, google_file_url, connected_at, last_exported_at, last_export_status, last_export_error")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSettings(data as DataExportRow) : null;
}

export async function updateDataExportSettings(
  companyId: string,
  input: {
    enabled: boolean;
    format: DataExportFormat;
    periodicity: DataExportPeriodicity;
    intervalDays: number;
  },
) {
  const { data, error } = await supabase.rpc("update_company_data_export_settings", {
    p_company_id: companyId,
    p_enabled: input.enabled,
    p_format: input.format,
    p_periodicity: input.periodicity,
    p_interval_days: input.intervalDays,
  });
  if (error) throw error;
  return mapSettings(data as DataExportRow);
}

export async function beginGoogleDriveConnection(returnUrl: string) {
  return invokeExportFunction<{ url: string }>({ action: "authorize", returnUrl });
}

export async function completeGoogleDriveConnection(code: string, state: string) {
  return invokeExportFunction<{ ok: true; initialSyncFailed: boolean }>({ action: "complete_oauth", code, state });
}

export async function syncDataExportNow() {
  return invokeExportFunction<{ ok: true; fileId: string; fileUrl: string | null; exportedAt: string }>({ action: "sync_now" });
}

export async function disconnectGoogleDrive() {
  return invokeExportFunction<{ ok: true }>({ action: "disconnect" });
}
