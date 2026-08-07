import { authLoginSchema, type AuthLoginInput } from "@cleaning-duties/shared";
import { supabase } from "@/lib/supabase";

export async function signIn(input: AuthLoginInput) {
  const values = authLoginSchema.parse(input);
  const credentials = values.identifier.includes("@")
    ? { email: values.identifier.trim(), password: values.password }
    : { phone: values.identifier.trim(), password: values.password };
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: "cleaningduties://reset-password",
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
