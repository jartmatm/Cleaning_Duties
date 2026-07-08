import { z } from "zod";
import { DUTY_PRIORITIES } from "../constants/priorities";
import { DUTY_STATUSES } from "../constants/statuses";

export const dutyFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(140),
  description: z.string().max(5000).optional().default(""),
  priority: z.enum(DUTY_PRIORITIES),
  status: z.enum(DUTY_STATUSES),
  dueDate: z.string().optional().default(""),
  equipment: z.string().optional().default(""),
  referencePhotos: z.string().optional().default(""),
});

export type DutyFormInput = z.input<typeof dutyFormSchema>;
