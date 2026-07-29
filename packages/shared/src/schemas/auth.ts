import { z } from "zod";

export const authLoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
  rememberMe: z.boolean(),
});

export type AuthLoginInput = z.infer<typeof authLoginSchema>;

export const ownerSignupSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name."),
  ownerName: z.string().trim().min(2, "Enter the owner name."),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export type OwnerSignupInput = z.infer<typeof ownerSignupSchema>;
