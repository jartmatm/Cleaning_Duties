import { AppLogo } from "../../components/common/app-logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authLoginSchema, type AuthLoginInput } from "@cleaning-duties/shared";
import { requestPasswordReset, signInWithCredentials } from "../../services/auth-service";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { notify } from "../../components/common/toast";

export function LoginPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AuthLoginInput>({
    resolver: zodResolver(authLoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(values: AuthLoginInput) {
    const result = await signInWithCredentials(values);
    if (!result.ok) {
      setErrorMessage(result.message);
      notify({ tone: "error", title: "Login failed", message: result.message });
      return;
    }

    notify({ tone: "success", title: "Welcome back", message: "Login completed successfully." });
    navigate("/");
  }

  async function onPasswordResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError(null);

    const email = resetEmail.trim();
    if (!email || !email.includes("@")) {
      setResetError("Enter a valid email address.");
      return;
    }

    setIsResetSubmitting(true);
    try {
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      notify({
        tone: "success",
        title: "Reset email sent",
        message: "Check your inbox to continue resetting your password.",
      });
      setResetEmail("");
      setIsResetOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send the password reset email.";
      setResetError(message);
      notify({ tone: "error", title: "Reset failed", message });
    } finally {
      setIsResetSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
      <Card className="grid w-full gap-8 lg:grid-cols-2 lg:p-8">
        <div className="space-y-6 rounded-[2rem] bg-slate-50 p-8 text-slate-900 ring-1 ring-slate-200">
          <AppLogo />
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Secure access</p>
            <h1 className="text-4xl font-semibold tracking-tight">Manage cleaning operations with clarity.</h1>
            <p className="max-w-md text-sm text-slate-600">
              Login with email or phone using Supabase Auth and keep every site, duty, and incident under one system.
            </p>
          </div>
        </div>
        <form className="space-y-4 p-2 lg:p-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-2 block text-sm font-medium">Email or phone</label>
            <Input placeholder="you@company.com" {...register("identifier")} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Password</label>
            <Input type="password" placeholder="••••••••" {...register("password")} />
          </div>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("rememberMe")} />
              Remember me
            </label>
            <button
              type="button"
              className="font-medium text-slate-900 transition hover:text-slate-600"
              onClick={() => {
                setResetError(null);
                setIsResetOpen(true);
              }}
            >
              Forgot your password?
            </button>
          </div>
          {errorMessage ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>
      </Card>
      {isResetOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md space-y-5 p-6 text-slate-950 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Password reset</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Reset your password</h2>
              <p className="text-sm text-slate-600">
                Enter your email and we will send you a secure link to create a new password.
              </p>
            </div>
            <form className="space-y-4" onSubmit={onPasswordResetSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email address</label>
                <Input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
                {resetError ? <p className="mt-2 text-sm text-red-600">{resetError}</p> : null}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setIsResetOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isResetSubmitting}>
                  {isResetSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
