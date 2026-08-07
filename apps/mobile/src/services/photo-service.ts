import { randomUUID } from "expo-crypto";
import { File as ExpoFile } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

export type LocalPhoto = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
};

function fromAsset(asset: ImagePicker.ImagePickerAsset): LocalPhoto {
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? "image/jpeg",
  };
}

export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera permission is required to take a photo.");
  const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
  return result.canceled || !result.assets[0] ? null : fromAsset(result.assets[0]);
}

export async function selectPhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo library permission is required to select a photo.");
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: false });
  return result.canceled || !result.assets[0] ? null : fromAsset(result.assets[0]);
}

async function optimizePhoto(photo: LocalPhoto) {
  const largestDimension = Math.max(photo.width, photo.height);
  const scale = largestDimension > 1600 ? 1600 / largestDimension : 1;
  const actions: ImageManipulator.Action[] = scale < 1
    ? [{ resize: { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) } }]
    : [];
  const result = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress: 0.72,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return new ExpoFile(result.uri);
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function uploadPhoto(input: { bucketName: string; path: string; photo: LocalPhoto }) {
  const optimized = await optimizePhoto(input.photo);
  const bytes = await optimized.arrayBuffer();
  const { error } = await supabase.storage.from(input.bucketName).upload(input.path, bytes, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(input.bucketName).getPublicUrl(input.path).data.publicUrl;
}

export async function uploadDutyPhotos(input: {
  bucketName: string;
  siteId: string;
  dutyTitle: string;
  type: "before" | "after";
  photos: LocalPhoto[];
}) {
  const urls: string[] = [];
  for (const photo of input.photos) {
    const fileName = `${safeSegment(input.dutyTitle || "duty")}-${randomUUID()}.jpg`;
    const path = `${safeSegment(input.siteId)}/${input.type}/${Date.now()}-${fileName}`;
    urls.push(await uploadPhoto({ bucketName: input.bucketName, path, photo }));
  }
  return urls;
}

export async function uploadUnplannedPhotos(input: {
  bucketName: string;
  siteId: string;
  cleanerId: string;
  requestId: string;
  dutyTitle: string;
  type: "before" | "after";
  photos: LocalPhoto[];
}) {
  const urls: string[] = [];
  for (const photo of input.photos) {
    const fileName = `${safeSegment(input.dutyTitle || "unplanned-duty")}-${randomUUID()}.jpg`;
    const path = [
      safeSegment(input.siteId),
      "unplanned",
      safeSegment(input.cleanerId),
      safeSegment(input.requestId),
      input.type,
      `${Date.now()}-${fileName}`,
    ].join("/");
    urls.push(await uploadPhoto({ bucketName: input.bucketName, path, photo }));
  }
  return urls;
}

function storagePathFromUrl(bucketName: string, photoUrl: string) {
  try {
    const parts = new URL(photoUrl).pathname.split("/").filter(Boolean);
    const accessIndex = parts.findIndex((segment) => segment === "public" || segment === "sign");
    const encodedBucket = parts[accessIndex + 1];
    if (accessIndex < 0 || !encodedBucket || decodeURIComponent(encodedBucket) !== bucketName) return null;
    return parts.slice(accessIndex + 2).map(decodeURIComponent).join("/") || null;
  } catch {
    return null;
  }
}

export async function deleteStoredPhotos(bucketName: string, photoUrls: string[]) {
  const paths = photoUrls
    .map((url) => storagePathFromUrl(bucketName, url))
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucketName).remove(paths);
  if (error) throw new Error(error.message);
}
