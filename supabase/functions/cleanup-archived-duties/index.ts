import { createClient } from "npm:@supabase/supabase-js@2.110.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_SIZE = 500;
const STORAGE_REMOVE_BATCH_SIZE = 1000;
const DATABASE_BATCH_SIZE = 200;

type SiteRow = {
  id: string;
  storage_bucket: string;
  info_photos: string[] | null;
};

type DutyRow = {
  id: string;
  site_id: string;
  status: string;
  completed_at: string | null;
  updated_at: string;
  reference_photos: string[] | null;
  completion_photos: string[] | null;
  before_photos: string[] | null;
  after_photos: string[] | null;
};

type DutyPhotoRow = {
  duty_id: string;
  storage_path: string;
  photo_type: string;
};

type StorageObject = {
  bucket: string;
  path: string;
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

function objectKey(object: StorageObject) {
  return `${object.bucket}\u0000${object.path}`;
}

function parseStorageUrl(value: string): StorageObject | null {
  try {
    const segments = new URL(value).pathname.split("/").filter(Boolean);
    const accessIndex = segments.findIndex((segment) => ["public", "sign", "authenticated"].includes(segment));
    const encodedBucket = segments[accessIndex + 1];
    if (accessIndex < 0 || !encodedBucket) return null;

    const bucket = decodeURIComponent(encodedBucket);
    const path = segments.slice(accessIndex + 2).map(decodeURIComponent).join("/");
    return bucket && path ? { bucket, path } : null;
  } catch {
    return null;
  }
}

function storageObjectForSite(site: SiteRow, value: string, allowRawPath = false): StorageObject | null {
  const parsed = parseStorageUrl(value);
  const object = parsed ?? (allowRawPath ? { bucket: site.storage_bucket, path: value.replace(/^\/+/, "") } : null);
  if (!object || object.bucket !== site.storage_bucket || !object.path.startsWith(`${site.id}/`)) return null;
  return object;
}

function addMediaObjects(target: Map<string, StorageObject>, site: SiteRow, values: Array<string[] | null | undefined>) {
  for (const value of values.flatMap((items) => items ?? [])) {
    const object = storageObjectForSite(site, value);
    if (object) target.set(objectKey(object), object);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase function credentials are unavailable" }, 500);
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice("Bearer ".length));
  if (authError || !authData.user) return jsonResponse({ error: "Your session is no longer valid" }, 401);

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.company_id) return jsonResponse({ error: "Profile not found" }, 404);

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("archive_cleanup_enabled, archive_cleanup_days")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (companyError) throw companyError;
    if (!company) return jsonResponse({ error: "Company not found" }, 404);
    if (!company.archive_cleanup_enabled) {
      return jsonResponse({ ok: true, deletedDutyCount: 0, deletedMediaCount: 0 });
    }

    const retentionDays = Math.min(Math.max(Number(company.archive_cleanup_days) || 10, 1), 999);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const sites = await fetchAllRows<SiteRow>((from, to) => admin
      .from("sites")
      .select("id, storage_bucket, info_photos")
      .eq("company_id", profile.company_id)
      .order("id")
      .range(from, to));

    const siteById = new Map(sites.map((site) => [site.id, site]));
    const siteByBucket = new Map(sites.map((site) => [site.storage_bucket, site]));
    const duties: DutyRow[] = [];
    for (const site of sites) {
      duties.push(...await fetchAllRows<DutyRow>((from, to) => admin
        .from("cleaning_duties")
        .select("id, site_id, status, completed_at, updated_at, reference_photos, completion_photos, before_photos, after_photos")
        .eq("site_id", site.id)
        .order("id")
        .range(from, to)));
    }

    const eligibleDutyIds = new Set(duties
      .filter((duty) => duty.status === "Archived")
      .filter((duty) => {
        const archivedAt = Date.parse(duty.completed_at ?? duty.updated_at);
        return Number.isFinite(archivedAt) && archivedAt < cutoff;
      })
      .map((duty) => duty.id));

    if (eligibleDutyIds.size === 0) {
      return jsonResponse({ ok: true, deletedDutyCount: 0, deletedMediaCount: 0 });
    }

    const candidateObjects = new Map<string, StorageObject>();
    const protectedObjects = new Map<string, StorageObject>();
    for (const duty of duties) {
      const site = siteById.get(duty.site_id);
      if (!site) continue;

      // Reference media is a permanent library reused by preloaded and recurring duties.
      addMediaObjects(protectedObjects, site, [duty.reference_photos]);
      addMediaObjects(eligibleDutyIds.has(duty.id) ? candidateObjects : protectedObjects, site, [
        duty.completion_photos,
        duty.before_photos,
        duty.after_photos,
      ]);
    }

    for (const site of sites) addMediaObjects(protectedObjects, site, [site.info_photos]);

    const preloadedDuties = await fetchAllRows<{ reference_photos: string[] | null }>((from, to) => admin
      .from("preloaded_duties")
      .select("reference_photos")
      .eq("company_id", profile.company_id)
      .order("id")
      .range(from, to));
    for (const photoUrl of preloadedDuties.flatMap((duty) => duty.reference_photos ?? [])) {
      const parsed = parseStorageUrl(photoUrl);
      const site = parsed ? siteByBucket.get(parsed.bucket) : null;
      if (site && parsed.path.startsWith(`${site.id}/`)) protectedObjects.set(objectKey(parsed), parsed);
    }

    const dutyById = new Map(duties.map((duty) => [duty.id, duty]));
    for (const dutyIdBatch of chunks(duties.map((duty) => duty.id), DATABASE_BATCH_SIZE)) {
      const dutyPhotos = await fetchAllRows<DutyPhotoRow>((from, to) => admin
        .from("duty_photos")
        .select("duty_id, storage_path, photo_type")
        .in("duty_id", dutyIdBatch)
        .order("id")
        .range(from, to));
      for (const photo of dutyPhotos) {
        const duty = dutyById.get(photo.duty_id);
        const site = duty ? siteById.get(duty.site_id) : null;
        if (!site) continue;
        const object = storageObjectForSite(site, photo.storage_path, true);
        const isReference = photo.photo_type.trim().toLowerCase().includes("reference");
        if (object) (eligibleDutyIds.has(photo.duty_id) && !isReference ? candidateObjects : protectedObjects).set(objectKey(object), object);
      }
    }

    const removableObjects = [...candidateObjects.entries()]
      .filter(([key]) => !protectedObjects.has(key))
      .map(([, object]) => object);
    const objectsByBucket = new Map<string, string[]>();
    for (const object of removableObjects) {
      objectsByBucket.set(object.bucket, [...(objectsByBucket.get(object.bucket) ?? []), object.path]);
    }

    let deletedMediaCount = 0;
    for (const [bucket, paths] of objectsByBucket) {
      for (const pathBatch of chunks(paths, STORAGE_REMOVE_BATCH_SIZE)) {
        const { data, error } = await admin.storage.from(bucket).remove(pathBatch);
        if (error) throw error;
        deletedMediaCount += data?.length ?? 0;
      }
    }

    let deletedDutyCount = 0;
    for (const dutyIdBatch of chunks([...eligibleDutyIds], DATABASE_BATCH_SIZE)) {
      const { data, error } = await admin
        .from("cleaning_duties")
        .delete()
        .in("id", dutyIdBatch)
        .select("id");
      if (error) throw error;
      deletedDutyCount += data?.length ?? 0;
    }

    console.info("cleanup-archived-duties", {
      companyId: profile.company_id,
      requestedBy: authData.user.id,
      retentionDays,
      deletedDutyCount,
      deletedMediaCount,
    });
    return jsonResponse({ ok: true, deletedDutyCount, deletedMediaCount });
  } catch (error) {
    const message = errorMessage(error, "Archived duty cleanup failed");
    console.error("cleanup-archived-duties", { requestedBy: authData.user.id, message });
    return jsonResponse({ error: message }, 500);
  }
});
