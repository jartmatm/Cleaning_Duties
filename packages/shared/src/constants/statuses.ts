export const DUTY_STATUSES = ["Draft", "Pending", "In Progress", "Completed", "Incomplete", "Overdue"] as const;

export type DutyStatus = (typeof DUTY_STATUSES)[number];
