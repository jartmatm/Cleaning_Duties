import { supabase } from "./supabase-client";

export type CompanyRecord = {
  id: string;
  name: string;
};

export async function getCompanyName(companyId: string) {
  const { data, error } = await supabase.from("companies").select("id, name").eq("id", companyId).single<CompanyRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data.name;
}
