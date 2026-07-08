export const DUTY_PRIORITIES = ["Urgent", "High", "Medium", "Low", "Periodical"] as const;

export type DutyPriority = (typeof DUTY_PRIORITIES)[number];
