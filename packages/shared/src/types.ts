export type UserRole = "Owner" | "Manager" | "Cleaner";

export type SiteRecord = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
