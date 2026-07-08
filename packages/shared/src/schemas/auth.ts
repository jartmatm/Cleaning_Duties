import { z } from "zod";

export const authLoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
  rememberMe: z.boolean(),
});

export type AuthLoginInput = z.infer<typeof authLoginSchema>;
