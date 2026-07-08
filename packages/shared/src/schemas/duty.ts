import { z } from "zod";
import { DUTY_PRIORITIES } from "../constants/priorities";
import { DUTY_STATUSES } from "../constants/statuses";

export const dutySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(140),
  description: z.string().max(5000).optional().default(""),
  priority: z.enum(DUTY_PRIORITIES),
  status: z.enum(DUTY_STATUSES),
  dueDate: z.string().datetime().nullable(),
  siteId: z.string().uuid(),
  createdBy: z.string().uuid(),
  assignedUsers: z.array(z.string().uuid()).default([]),
  equipment: z.array(z.string().min(1)).default([]),
  referencePhotos: z.array(z.string().url()).default([]),
  completionPhotos: z.array(z.string().url()).default([]),
  comments: z.array(z.unknown()).default([]),
  history: z.array(z.unknown()).default([]),
  incidents: z.array(z.unknown()).default([]),
});

export type DutyInput = z.infer<typeof dutySchema>;
