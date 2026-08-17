const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const defaultOneSignalAppId = "3d22eb0b-ce92-4065-b9dc-bf43c4e5d10d";

export const mobileConfig = {
  supabaseUrl,
  supabaseKey: supabasePublishableKey || supabaseAnonKey,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim(),
  oneSignalAppId: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() || defaultOneSignalAppId,
};

export const hasSupabaseConfig = Boolean(mobileConfig.supabaseUrl && mobileConfig.supabaseKey);

export const missingSupabaseVariables = [
  !mobileConfig.supabaseUrl ? "EXPO_PUBLIC_SUPABASE_URL" : null,
  !mobileConfig.supabaseKey ? "EXPO_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : null,
].filter((value): value is string => Boolean(value));
