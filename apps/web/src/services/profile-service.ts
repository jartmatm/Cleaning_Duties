import { supabase } from "./supabase-client";

export type ProfileRecord = {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  role: "Owner" | "Manager" | "Cleaner";
};

export async function getCurrentProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, phone, role")
    .eq("id", userId)
    .single<ProfileRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
