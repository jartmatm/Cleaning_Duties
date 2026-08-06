import type { DutyItem } from "./duties-service";
import { deleteDutyEvidencePhotos, uploadUnplannedDutyPhotos } from "./duty-photo-service";
import { supabase } from "./supabase-client";

export type ActiveDutyShift = {
  startsAt: string;
  endsAt: string;
};

export type UnplannedDutyRequest = {
  id: string;
  companyId: string;
  siteId: string;
  siteName: string;
  storageBucket: string;
  cleanerId: string;
  cleanerName: string;
  title: string;
  description: string;
  location: string;
  shiftStartedAt: string;
  shiftEndsAt: string;
  reportedCompletedAt: string;
  beforePhotos: string[];
  afterPhotos: string[];
  createdAt: string;
};

type UnplannedDutyRequestRow = {
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

type ReviewResult = {
  approved: boolean;
  duty_id: string | null;
  storage_bucket: string;
  before_photos: string[];
  after_photos: string[];
};

const REQUEST_SELECT = "id, company_id, site_id, cleaner_id, title, description, location, shift_started_at, shift_ends_at, reported_completed_at, before_photos, after_photos, created_at, cleaner:profiles!unplanned_duty_requests_cleaner_id_fkey(full_name), site:sites!unplanned_duty_requests_site_id_fkey(name, storage_bucket)";

function mapRequest(row: UnplannedDutyRequestRow): UnplannedDutyRequest {
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

export function getActiveDutyShift(duties: DutyItem[], siteId: string | undefined, nowValue = Date.now()): ActiveDutyShift | null {
  if (!siteId) {
    return null;
  }

  const activeDuty = duties
    .filter((duty) => duty.siteId === siteId && duty.startsAt && duty.dueDate && ["Scheduled", "Pending", "In Progress", "Completed"].includes(duty.status))
    .filter((duty) => {
      const startsAt = new Date(duty.startsAt ?? "").getTime();
      const endsAt = new Date(duty.dueDate ?? "").getTime();
      return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= nowValue && endsAt > nowValue;
    })
    .sort((a, b) => new Date(b.startsAt ?? 0).getTime() - new Date(a.startsAt ?? 0).getTime())[0];

  return activeDuty?.startsAt && activeDuty.dueDate
    ? { startsAt: activeDuty.startsAt, endsAt: activeDuty.dueDate }
    : null;
}

export async function submitUnplannedDutyRequest(input: {
  companyId: string;
  siteId: string;
  storageBucket: string;
  cleanerId: string;
  shift: ActiveDutyShift;
  title: string;
  description: string;
  location: string;
  beforeFiles: File[];
  afterFiles: File[];
}) {
  const requestId = crypto.randomUUID();
  const reportedCompletedAt = new Date().toISOString();
  let beforePhotos: string[] = [];
  let afterPhotos: string[] = [];

  try {
    beforePhotos = await uploadUnplannedDutyPhotos({
      bucketName: input.storageBucket,
      siteId: input.siteId,
      cleanerId: input.cleanerId,
      requestId,
      dutyTitle: input.title,
      files: input.beforeFiles,
      type: "before",
    });
    afterPhotos = await uploadUnplannedDutyPhotos({
      bucketName: input.storageBucket,
      siteId: input.siteId,
      cleanerId: input.cleanerId,
      requestId,
      dutyTitle: input.title,
      files: input.afterFiles,
      type: "after",
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
        before_photos: beforePhotos,
        after_photos: afterPhotos,
      })
      .select(REQUEST_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRequest(data as unknown as UnplannedDutyRequestRow);
  } catch (error) {
    const uploadedPhotos = [...beforePhotos, ...afterPhotos];
    if (uploadedPhotos.length > 0) {
      try {
        await deleteDutyEvidencePhotos({ bucketName: input.storageBucket, photoUrls: uploadedPhotos });
      } catch (cleanupError) {
        console.warn("Could not clean up unplanned duty photos", cleanupError);
      }
    }
    throw error;
  }
}

export async function listUnplannedDutyRequests(siteId: string) {
  const { data, error } = await supabase
    .from("unplanned_duty_requests")
    .select(REQUEST_SELECT)
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapRequest(row as unknown as UnplannedDutyRequestRow));
}

export async function reviewUnplannedDutyRequest(requestId: string, approve: boolean) {
  const { data, error } = await supabase.rpc("review_unplanned_duty_request", {
    p_request_id: requestId,
    p_approve: approve,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as ReviewResult;
  if (!approve) {
    const photoUrls = [...(result.before_photos ?? []), ...(result.after_photos ?? [])];
    if (photoUrls.length > 0 && result.storage_bucket) {
      try {
        await deleteDutyEvidencePhotos({ bucketName: result.storage_bucket, photoUrls });
      } catch (cleanupError) {
        console.warn("The request was rejected, but its storage cleanup failed", cleanupError);
      }
    }
  }

  return result;
}
