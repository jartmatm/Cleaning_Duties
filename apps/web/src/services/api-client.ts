const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const apiBaseUrl = rawBaseUrl?.trim() || "";

export function apiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
