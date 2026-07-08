import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
