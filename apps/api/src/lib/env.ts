import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  APP_URL: z.string().url().optional(),
  ONESIGNAL_APP_ID: z.string().uuid().optional(),
  ONESIGNAL_REST_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
