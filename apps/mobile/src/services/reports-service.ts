import { supabase } from "@/lib/supabase";
import type { ServiceReport } from "@/types/domain";

type ServiceReportRow = {
  id: string;
  company_id: string;
  site_id: string | null;
  created_by: string;
  title: string;
  date_from: string;
  date_to: string;
  snapshot: Record<string, unknown>;
  created_at: string;
};

export async function listServiceReports(companyId: string, siteId: string, manager: boolean) {
  let query = supabase
    .from("service_reports")
    .select("id, company_id, site_id, created_by, title, date_from, date_to, snapshot, created_at")
    .eq("company_id", companyId);
  if (!manager) query = query.eq("site_id", siteId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const item = row as ServiceReportRow;
    return {
      id: item.id,
      companyId: item.company_id,
      siteId: item.site_id,
      createdBy: item.created_by,
      title: item.title,
      dateFrom: item.date_from,
      dateTo: item.date_to,
      snapshot: item.snapshot,
      createdAt: item.created_at,
    } satisfies ServiceReport;
  });
}
