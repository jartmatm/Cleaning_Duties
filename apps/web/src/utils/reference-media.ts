export type ReferenceMediaType = "image" | "video";

const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"]);

function extensionFromValue(value: string) {
  const normalizedValue = value.split("?")[0]?.split("#")[0] ?? value;
  return normalizedValue.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "";
}

export function isVideoFile(file: File) {
  return file.type.startsWith("video/") || VIDEO_EXTENSIONS.has(extensionFromValue(file.name));
}

export function getReferenceMediaType(url: string): ReferenceMediaType {
  try {
    const pathname = decodeURIComponent(new URL(url, "https://local.invalid").pathname);
    return VIDEO_EXTENSIONS.has(extensionFromValue(pathname)) ? "video" : "image";
  } catch {
    return VIDEO_EXTENSIONS.has(extensionFromValue(url)) ? "video" : "image";
  }
}
