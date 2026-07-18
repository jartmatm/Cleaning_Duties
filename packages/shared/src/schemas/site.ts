import { z } from "zod";

export const siteSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(120),
  address: z.string().max(240).nullable().optional(),
  notes: z.string().max(1000).default(""),
  storageBucket: z.string().min(1).max(120).optional().default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const siteFormSchema = z.object({
  name: z.string().min(1, "Site name is required").max(120),
  address: z.string().max(240).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

export type SiteFormInput = z.input<typeof siteFormSchema>;
export type SiteInput = z.infer<typeof siteSchema>;
