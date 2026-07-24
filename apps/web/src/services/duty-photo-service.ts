import { supabase } from "./supabase-client";
import { optimizeImageForUpload } from "./image-optimization-service";

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
  folder?: string;
}) {
  const uploadedUrls: string[] = [];

  for (const file of params.files) {
    const optimizedImage = await optimizeImageForUpload(file);
    const uploadFile = optimizedImage.file;
    const fileName = `${safeSegment(params.dutyTitle || "duty")}-${crypto.randomUUID()}.${fileExtension(uploadFile.name)}`;
    const storagePath = `${safeSegment(params.siteId)}/${safeSegment(params.folder ?? "reference")}/${Date.now()}-${fileName}`;
    const { error } = await supabase.storage.from(params.bucketName).upload(storagePath, uploadFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: uploadFile.type || "image/jpeg",
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from(params.bucketName).getPublicUrl(storagePath);
    uploadedUrls.push(data.publicUrl);

    console.info("Duty photo optimized", {
      originalBytes: optimizedImage.originalBytes,
      optimizedBytes: optimizedImage.optimizedBytes,
      reductionPercentage: optimizedImage.reductionPercentage,
      originalDimensions: `${optimizedImage.originalWidth}x${optimizedImage.originalHeight}`,
      optimizedDimensions: `${optimizedImage.optimizedWidth}x${optimizedImage.optimizedHeight}`,
    });
  }

  return uploadedUrls;
}

export async function uploadDutyEvidencePhotos(params: {
  bucketName: string;
  siteId: string;
  dutyTitle: string;
  files: File[];
  type: "before" | "after";
}) {
  return uploadDutyReferencePhotos({
    bucketName: params.bucketName,
    siteId: params.siteId,
    dutyTitle: params.dutyTitle,
    files: params.files,
    folder: params.type,
  });
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
