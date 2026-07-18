import { supabase } from "./supabase-client";

export type CompanyRecord = {
  id: string;
  name: string;
  logo_url: string | null;
  color_palette: string;
};

export type CompanySettings = {
  id: string;
  name: string;
  logoUrl: string | null;
  colorPalette: string;
};

function mapCompany(row: CompanyRecord): CompanySettings {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    colorPalette: row.color_palette,
  };
}

export async function getCompanySettings(companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, logo_url, color_palette")
    .eq("id", companyId)
    .single<CompanyRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return mapCompany(data);
}

export async function getCompanyName(companyId: string) {
  const company = await getCompanySettings(companyId);
  return company.name;
}

export async function updateCompanySettings(companyId: string, input: { name: string; logoUrl: string | null; colorPalette: string }) {
  const { data, error } = await supabase
    .from("companies")
    .update({
      name: input.name,
      logo_url: input.logoUrl,
      color_palette: input.colorPalette,
    })
    .eq("id", companyId)
    .select("id, name, logo_url, color_palette")
    .single<CompanyRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return mapCompany(data);
}

export async function uploadCompanyLogo(companyId: string, file: File) {
  const extension = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? "png";
  const storagePath = `${companyId}/logo-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("company-assets").upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "image/png",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("company-assets").getPublicUrl(storagePath);
  return data.publicUrl;
}
