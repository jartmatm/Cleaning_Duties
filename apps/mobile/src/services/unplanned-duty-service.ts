import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";
import type { ActiveDutyShift, UnplannedDutyRequest } from "@/types/domain";
import { deleteStoredPhotos, uploadUnplannedPhotos, type LocalPhoto } from "./photo-service";

type RequestRow = {
  id: string;
  company_id: string;
  site_id: string;
  cleaner_id: string;
  title: string;
  description: string;
  location: string;
  shift_started_at: string;
  shift_ends_at: string;
  reported_completed_at: string;
  before_photos: string[];
  after_photos: string[];
  created_at: string;
  cleaner: { full_name: string } | null;
  site: { name: string; storage_bucket: string } | null;
};

const REQUEST_SELECT = "id, company_id, site_id, cleaner_id, title, description, location, shift_started_at, shift_ends_at, reported_completed_at, before_photos, after_photos, created_at, cleaner:profiles!unplanned_duty_requests_cleaner_id_fkey(full_name), site:sites!unplanned_duty_requests_site_id_fkey(name, storage_bucket)";

function mapRequest(row: RequestRow): UnplannedDutyRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    siteId: row.site_id,
    siteName: row.site?.name ?? "Assigned site",
    storageBucket: row.site?.storage_bucket ?? `site-${row.site_id}`,
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner?.full_name ?? "Cleaner",
    title: row.title,
    description: row.description,
    location: row.location,
    shiftStartedAt: row.shift_started_at,
    shiftEndsAt: row.shift_ends_at,
    reportedCompletedAt: row.reported_completed_at,
    beforePhotos: row.before_photos ?? [],
    afterPhotos: row.after_photos ?? [],
    createdAt: row.created_at,
  };
}

export async function listUnplannedRequests(siteId: string) {
  const { data, error } = await supabase
    .from("unplanned_duty_requests")
    .select(REQUEST_SELECT)
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRequest(row as unknown as RequestRow));
}

export async function submitUnplannedRequest(input: {
  companyId: string;
  siteId: string;
  storageBucket: string;
  cleanerId: string;
  shift: ActiveDutyShift;
  title: string;
  description: string;
  location: string;
  beforePhotos: LocalPhoto[];
  afterPhotos: LocalPhoto[];
}) {
  const requestId = randomUUID();
  const reportedCompletedAt = new Date().toISOString();
  let beforeUrls: string[] = [];
  let afterUrls: string[] = [];
  try {
    beforeUrls = await uploadUnplannedPhotos({
      bucketName: input.storageBucket,
      siteId: input.siteId,
      cleanerId: input.cleanerId,
      requestId,
      dutyTitle: input.title,
      type: "before",
      photos: input.beforePhotos,
    });
    afterUrls = await uploadUnplannedPhotos({
      bucketName: input.storageBucket,
      siteId: input.siteId,
      cleanerId: input.cleanerId,
      requestId,
      dutyTitle: input.title,
      type: "after",
      photos: input.afterPhotos,
    });
    const { data, error } = await supabase
      .from("unplanned_duty_requests")
      .insert({
        id: requestId,
        company_id: input.companyId,
        site_id: input.siteId,
        cleaner_id: input.cleanerId,
        title: input.title.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        shift_started_at: input.shift.startsAt,
        shift_ends_at: input.shift.endsAt,
        reported_completed_at: reportedCompletedAt,
        before_photos: beforeUrls,
        after_photos: afterUrls,
      })
      .select(REQUEST_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapRequest(data as unknown as RequestRow);
  } catch (error) {
    const uploaded = [...beforeUrls, ...afterUrls];
    if (uploaded.length > 0) await deleteStoredPhotos(input.storageBucket, uploaded).catch(() => undefined);
    throw error;
  }
}

export async function reviewUnplannedRequest(requestId: string, approve: boolean) {
  const { data, error } = await supabase.rpc("review_unplanned_duty_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw new Error(error.message);
  const result = data as { storage_bucket: string; before_photos: string[]; after_photos: string[] };
  if (!approve) {
    await deleteStoredPhotos(result.storage_bucket, [...(result.before_photos ?? []), ...(result.after_photos ?? [])]).catch(() => undefined);
  }
  return result;
}
