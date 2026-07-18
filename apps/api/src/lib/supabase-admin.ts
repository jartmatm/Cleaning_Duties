import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export function createSupabaseAdminClient(): SupabaseClient {
  const url = env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  }

  return createClient(url, key);
}
