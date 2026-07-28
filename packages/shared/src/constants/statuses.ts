export const DUTY_STATUSES = ["Draft", "Scheduled", "Pending", "In Progress", "Completed", "Incomplete", "Overdue", "Missed", "Archived"] as const;

export type DutyStatus = (typeof DUTY_STATUSES)[number];
