import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, type AppStateStatus } from "react-native";
import "react-native-url-polyfill/auto";
import { hasSupabaseConfig, mobileConfig } from "./config";

export const supabase = createClient(
  mobileConfig.supabaseUrl ?? "http://127.0.0.1:54321",
  mobileConfig.supabaseKey ?? "missing-public-supabase-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: AsyncStorage,
    },
  },
);

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

export function registerSupabaseAutoRefresh() {
  if (!hasSupabaseConfig || appStateSubscription) {
    return () => undefined;
  }

  const updateRefreshState = (state: AppStateStatus) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  updateRefreshState(AppState.currentState);
  appStateSubscription = AppState.addEventListener("change", updateRefreshState);

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
    supabase.auth.stopAutoRefresh();
  };
}
