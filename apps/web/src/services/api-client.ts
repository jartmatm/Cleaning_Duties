const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const apiBaseUrl = rawBaseUrl?.trim() || (import.meta.env.DEV ? "http://localhost:3001" : "");

export function apiUrl(path: string) {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_BASE_URL is not configured. Set it to the deployed API URL.");
  }

  return `${apiBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
