import type { DutyPriority, DutyStatus, IncidentType, UserRole } from "@cleaning-duties/shared";

export type Profile = {
  id: string;
  companyId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
};

export type Company = {
  id: string;
  name: string;
  logoUrl: string | null;
  colorPalette: string;
};

export type Site = {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  notes: string;
  infoPhotos: string[];
  storageBucket: string;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
};

export type Duty = {
  id: string;
  siteId: string;
  createdBy: string;
  title: string;
  description: string;
  priority: DutyPriority;
  status: DutyStatus;
  startsAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  previousDutyId: string | null;
  recurring: boolean;
  recurringRule: string | null;
  equipment: string[];
  referencePhotos: string[];
  completionPhotos: string[];
  beforePhotos: string[];
  afterPhotos: string[];
  assignedUserIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type DutyComment = {
  id: string;
  profileId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type DutyDetail = Duty & {
  assignedUsers: { id: string; name: string }[];
  comments: DutyComment[];
  incidents: Incident[];
};

export type Incident = {
  id: string;
  dutyId: string | null;
  siteId: string;
  reportedBy: string;
  incidentType: IncidentType;
  details: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type ServiceReport = {
  id: string;
  companyId: string;
  siteId: string | null;
  createdBy: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
};

export type ActiveDutyShift = {
  startsAt: string;
  endsAt: string;
};

export type UnplannedDutyRequest = {
  id: string;
  companyId: string;
  siteId: string;
  siteName: string;
  storageBucket: string;
  cleanerId: string;
  cleanerName: string;
  title: string;
  description: string;
  location: string;
  shiftStartedAt: string;
  shiftEndsAt: string;
  reportedCompletedAt: string;
  beforePhotos: string[];
  afterPhotos: string[];
  createdAt: string;
};
