import { authLoginSchema, type AuthLoginInput } from "@cleaning-duties/shared";
import { supabase } from "@/lib/supabase";
import { emitNotificationEventSafely } from "./notification-events-service";
import { oneSignalService } from "./onesignal-service";

export async function signIn(input: AuthLoginInput) {
  const values = authLoginSchema.parse(input);
  const credentials = values.identifier.includes("@")
    ? { email: values.identifier.trim(), password: values.password }
    : { phone: values.identifier.trim(), password: values.password };
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw new Error(error.message);
  if (data.session) {
    oneSignalService.identifyUser(data.user.id, data.user.email);
    await emitNotificationEventSafely({ event: "session_started" });
  }
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
