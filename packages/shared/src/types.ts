export type UserRole = "Owner" | "Manager" | "Cleaner";

export type SiteRecord = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  notes: string;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  createdAt: string;
  updatedAt: string;
};
