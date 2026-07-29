import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authLoginSchema, ownerSignupSchema, type AuthLoginInput, type OwnerSignupInput } from "@cleaning-duties/shared";
import { requestPasswordReset, signInWithCredentials, signUpOwner } from "../../services/auth-service";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { notify } from "../../components/common/toast";
import dataCleanAnimation from "../../assets/data-clean-lottie.json";

function DataCleanLottiePreview() {
  const { w, h } = dataCleanAnimation;

  return (
    <div className="relative h-44 w-44 sm:h-56 sm:w-56" aria-hidden="true">
      <svg className="h-full w-full" viewBox={`0 0 ${w} ${h}`} role="img">
        <g className="origin-center animate-[login-card-float_3s_ease-in-out_infinite]">
          <rect x="101" y="96" width="98" height="98" rx="10" className="fill-slate-900" />
          <rect x="100" y="96" width="98" height="98" rx="10" className="fill-white opacity-10" />
        </g>
        <g className="animate-[login-line-one_3s_ease-in-out_infinite]">
          <rect x="115" y="114" width="90" height="15" rx="3" className="fill-slate-500" />
        </g>
        <g className="animate-[login-line-two_3s_ease-in-out_infinite]">
          <rect x="115" y="143" width="85" height="15" rx="3" className="fill-slate-400" />
        </g>
        <g className="animate-[login-line-three_3s_ease-in-out_infinite]">
          <rect x="115" y="172" width="98" height="15" rx="3" className="fill-slate-600" />
        </g>
      </svg>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const loginForm = useForm<AuthLoginInput>({
    resolver: zodResolver(authLoginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: false,
    },
  });
  const signupForm = useForm<OwnerSignupInput>({
    resolver: zodResolver(ownerSignupSchema),
    defaultValues: {
      companyName: "",
      ownerName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { isSubmitting },
  } = loginForm;
  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    formState: { isSubmitting: isSignupSubmitting, errors: signupErrors },
  } = signupForm;

  async function onSubmit(values: AuthLoginInput) {
    setErrorMessage(null);
    const result = await signInWithCredentials(values);
    if (!result.ok) {
      setErrorMessage(result.message);
      notify({ tone: "error", title: "Login failed", message: result.message });
      return;
    }

    notify({ tone: "success", title: "Welcome back", message: "Login completed successfully." });
    navigate("/");
  }

  async function onSignupSubmit(values: OwnerSignupInput) {
    setErrorMessage(null);
    const result = await signUpOwner(values);

    if (!result.ok) {
      setErrorMessage(result.message);
      notify({ tone: "error", title: "Sign up failed", message: result.message });
      return;
    }

    if (result.needsEmailConfirmation) {
      notify({ tone: "success", title: "Company created", message: "Check your email to confirm the owner account." });
      switchMode("login");
      return;
    }

    notify({ tone: "success", title: "Company created", message: "Your owner account is ready." });
    navigate("/");
  }

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setErrorMessage(null);
    loginForm.clearErrors();
    signupForm.clearErrors();
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
        <div className="space-y-6 rounded-lg bg-slate-50 p-8 text-slate-900 ring-1 ring-slate-200">
          <div className="flex justify-center">
            <DataCleanLottiePreview />
          </div>
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">WELCOME</p>
            <h1 className="text-4xl font-semibold tracking-tight">Cleaning Duties...</h1>
            <p className="max-w-md text-sm text-slate-600">Manage cleaning operations with clarity.</p>
          </div>
        </div>
        {mode === "login" ? (
          <form className="space-y-4 p-2 lg:p-4" onSubmit={handleLoginSubmit(onSubmit)}>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Email or phone</label>
              <Input placeholder="you@company.com" {...registerLogin("identifier")} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Password</label>
              <Input type="password" placeholder="••••••••" {...registerLogin("password")} />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...registerLogin("rememberMe")} />
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
            {errorMessage ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
            <Button className="w-full !bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Login"
              )}
            </Button>
            <Button type="button" className="w-full !bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800" onClick={() => switchMode("signup")}>
              Sign up
            </Button>
          </form>
        ) : (
          <form className="space-y-4 p-2 lg:p-4" onSubmit={handleSignupSubmit(onSignupSubmit)}>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Company name</label>
              <Input placeholder="Company name" {...registerSignup("companyName")} />
              {signupErrors.companyName ? <p className="mt-1 text-sm text-red-600">{signupErrors.companyName.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Owner name</label>
              <Input placeholder="Your name" {...registerSignup("ownerName")} />
              {signupErrors.ownerName ? <p className="mt-1 text-sm text-red-600">{signupErrors.ownerName.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Email</label>
              <Input type="email" placeholder="owner@company.com" {...registerSignup("email")} />
              {signupErrors.email ? <p className="mt-1 text-sm text-red-600">{signupErrors.email.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Password</label>
              <Input type="password" placeholder="Create a secure password" {...registerSignup("password")} />
              {signupErrors.password ? <p className="mt-1 text-sm text-red-600">{signupErrors.password.message}</p> : null}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-black">Confirm password</label>
              <Input type="password" placeholder="Confirm password" {...registerSignup("confirmPassword")} />
              {signupErrors.confirmPassword ? <p className="mt-1 text-sm text-red-600">{signupErrors.confirmPassword.message}</p> : null}
            </div>
            {errorMessage ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
            <Button className="w-full !bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800" disabled={isSignupSubmitting}>
              {isSignupSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create company"
              )}
            </Button>
            <Button type="button" className="w-full !bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800" onClick={() => switchMode("login")}>
              Back to login
            </Button>
          </form>
        )}
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
