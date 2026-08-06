export type UserRole = "Manager" | "Supervisor" | "Cleaner";

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
