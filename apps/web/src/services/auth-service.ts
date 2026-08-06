import { authLoginSchema, managerSignupSchema, type AuthLoginInput, type ManagerSignupInput } from "@cleaning-duties/shared";
import { setRememberMe, supabase } from "./supabase-client";

type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

type SignupResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; message: string };

function isEmail(identifier: string) {
  return identifier.includes("@");
}

export function validateLogin(input: unknown): AuthLoginInput {
  return authLoginSchema.parse(input);
}

export function validateManagerSignup(input: unknown): ManagerSignupInput {
  return managerSignupSchema.parse(input);
}

export async function signInWithCredentials(input: unknown): Promise<LoginResult> {
  const { identifier, password, rememberMe } = validateLogin(input);
  setRememberMe(rememberMe);

  const result = isEmail(identifier)
    ? await supabase.auth.signInWithPassword({ email: identifier, password })
    : await supabase.auth.signInWithPassword({ phone: identifier, password });

  if (result.error) {
    return { ok: false, message: result.error.message };
  }

  return { ok: true };
}

export async function signUpManager(input: unknown): Promise<SignupResult> {
  const values = validateManagerSignup(input);
  setRememberMe(true);

  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: "https://cleaning-duties-web.vercel.app/",
      data: {
        company_name: values.companyName,
        full_name: values.managerName,
        role: "Manager",
      },
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, needsEmailConfirmation: !data.session };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(error.message);
  }
}
