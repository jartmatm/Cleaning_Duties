import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseKey = supabaseAnonKey ?? supabasePublishableKey;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

if (!hasSupabaseConfig && !import.meta.env.DEV) {
  throw new Error("Missing VITE_SUPABASE_URL and a Supabase key.");
}

function createStorage() {
  const rememberKey = "cleaning-duties.remember-me";

  return {
    getItem(key: string) {
      const preferredStorage = localStorage.getItem(rememberKey) === "true" ? localStorage : sessionStorage;
      return preferredStorage.getItem(key);
    },
    setItem(key: string, value: string) {
      const preferredStorage = localStorage.getItem(rememberKey) === "true" ? localStorage : sessionStorage;
      preferredStorage.setItem(key, value);
    },
    removeItem(key: string) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };
}

export const supabase = createClient(supabaseUrl ?? "http://localhost", supabaseKey ?? "missing-supabase-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: createStorage(),
  },
});

export function setRememberMe(remember: boolean) {
  localStorage.setItem("cleaning-duties.remember-me", String(remember));
}
