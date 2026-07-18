import { supabase } from "./supabase-client";

function fileExtension(fileName: string) {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function uploadDutyReferencePhotos(params: {
  bucketName: string;
  siteId: string;
  dutyTitle: string;
  files: File[];
}) {
  const uploadedUrls: string[] = [];

  for (const file of params.files) {
    const fileName = `${safeSegment(params.dutyTitle || "duty")}-${crypto.randomUUID()}.${fileExtension(file.name)}`;
    const storagePath = `${safeSegment(params.siteId)}/reference/${Date.now()}-${fileName}`;
    const { error } = await supabase.storage.from(params.bucketName).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(params.bucketName).getPublicUrl(storagePath);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

export async function uploadDutyReferencePhoto(params: {
  bucketName: string;
  siteId: string;
  dutyTitle: string;
  file: File;
}): Promise<string> {
  const [uploadedUrl] = await uploadDutyReferencePhotos({
    bucketName: params.bucketName,
    siteId: params.siteId,
    dutyTitle: params.dutyTitle,
    files: [params.file],
  });

  if (!uploadedUrl) {
    throw new Error("Upload failed without a public URL");
  }

  return uploadedUrl;
}
