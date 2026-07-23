import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { notify } from "../../components/common/toast";
import { AppLogo } from "../../components/common/app-logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { signOut, updatePassword } from "../../services/auth-service";
import { supabase } from "../../services/supabase-client";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let mounted = true;

    async function verifyRecoverySession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (!data.session?.user) {
        setSessionError("This password reset link is invalid or has expired. Request a new link from the login page.");
        setSessionReady(false);
        return;
      }

      setSessionReady(true);
    }

    verifyRecoverySession().catch((error: unknown) => {
      if (!mounted) {
        return;
      }
      setSessionError(error instanceof Error ? error.message : "Unable to validate the password reset session.");
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(values: ResetPasswordInput) {
    try {
      await updatePassword(values.password);
      await signOut();
      notify({
        tone: "success",
        title: "Password updated",
        message: "You can now log in with your new password.",
      });
      navigate("/login", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update your password.";
      notify({ tone: "error", title: "Password update failed", message });
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg items-center justify-center">
      <Card className="w-full space-y-6 p-8 text-slate-950">
        <AppLogo />
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Account recovery</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Create a new password.</h1>
          <p className="text-sm text-slate-600">Choose a secure password to regain access to Cleaning Duties.</p>
        </div>

        {sessionError ? (
          <div className="space-y-4">
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{sessionError}</p>
            <Button type="button" className="w-full" onClick={() => navigate("/login", { replace: true })}>
              Back to login
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">New password</label>
              <Input type="password" autoComplete="new-password" {...register("password")} />
              {errors.password ? <p className="mt-2 text-sm text-red-600">{errors.password.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
              <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
              {errors.confirmPassword ? (
                <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
              ) : null}
            </div>
            <Button className="w-full" disabled={!sessionReady || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
