import { z } from "zod";

export const siteSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(120),
  address: z.string().max(240).nullable().optional(),
  notes: z.string().max(1000).default(""),
  shiftStartTime: z.string().max(5).nullable().optional(),
  shiftEndTime: z.string().max(5).nullable().optional(),
  storageBucket: z.string().min(1).max(120).optional().default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const siteFormSchema = z.object({
  name: z.string().min(1, "Site name is required").max(120),
  address: z.string().max(240).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  shiftStartTime: z.string().optional().default(""),
  shiftEndTime: z.string().optional().default(""),
});

export type SiteFormInput = z.input<typeof siteFormSchema>;
export type SiteInput = z.infer<typeof siteSchema>;
