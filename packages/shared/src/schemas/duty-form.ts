import { z } from "zod";
import { DUTY_PRIORITIES } from "../constants/priorities";
import { DUTY_STATUSES } from "../constants/statuses";

const recurringWeekdaysSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === false) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}, z.array(z.coerce.number().int().min(0).max(6)).optional().default([1]));

export const dutyFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(140),
  description: z.string().max(5000).optional().default(""),
  priority: z.enum(DUTY_PRIORITIES),
  status: z.enum(DUTY_STATUSES),
  dueDate: z.string().optional().default(""),
  recurringPattern: z.string().optional().default("daily"),
  recurringInterval: z.coerce.number().int().min(1).max(365).optional().default(1),
  recurringWeekday: z.coerce.number().int().min(0).max(6).optional().default(1),
  recurringWeekdays: recurringWeekdaysSchema,
  equipment: z.string().optional().default(""),
  referencePhotos: z.string().optional().default(""),
  assignedUserIds: z.array(z.string().uuid()).optional().default([]),
});

export type DutyFormInput = z.input<typeof dutyFormSchema>;
