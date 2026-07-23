import { supabase } from "./supabase-client";

export type ReportDutySnapshot = {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  beforePhotos: string[];
  afterPhotos: string[];
};

export type ServiceReportSnapshot = {
  companyName: string;
  companyLogoUrl: string | null;
  siteName: string | null;
  preparedBy: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  completedCount: number;
  totalCount: number;
  duties: ReportDutySnapshot[];
};

export type ServiceReportRow = {
  id: string;
  company_id: string;
  site_id: string | null;
  created_by: string;
  title: string;
  date_from: string;
  date_to: string;
  snapshot: ServiceReportSnapshot;
  created_at: string;
};

export type ServiceReportItem = {
  id: string;
  companyId: string;
  siteId: string | null;
  createdBy: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  snapshot: ServiceReportSnapshot;
  createdAt: string;
};

function mapReport(row: ServiceReportRow): ServiceReportItem {
  return {
    id: row.id,
    companyId: row.company_id,
    siteId: row.site_id,
    createdBy: row.created_by,
    title: row.title,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    snapshot: row.snapshot,
    createdAt: row.created_at,
  };
}

export async function listServiceReports(companyId: string) {
  const { data, error } = await supabase
    .from("service_reports")
    .select("id, company_id, site_id, created_by, title, date_from, date_to, snapshot, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapReport(row as ServiceReportRow));
}

export async function createServiceReport(input: {
  companyId: string;
  siteId: string | null;
  createdBy: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  snapshot: ServiceReportSnapshot;
}) {
  const { data, error } = await supabase
    .from("service_reports")
    .insert({
      company_id: input.companyId,
      site_id: input.siteId,
      created_by: input.createdBy,
      title: input.title,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      snapshot: input.snapshot,
    })
    .select("id, company_id, site_id, created_by, title, date_from, date_to, snapshot, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapReport(data as ServiceReportRow);
}
