import { AppLogo } from "../../components/common/app-logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authLoginSchema, type AuthLoginInput } from "@cleaning-duties/shared";
import { signInWithCredentials } from "../../services/auth-service";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function LoginPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      return;
    }

    navigate("/");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
      <Card className="grid w-full gap-8 lg:grid-cols-2 lg:p-8">
        <div className="space-y-6 rounded-[2rem] bg-slate-950 p-8 text-white">
          <AppLogo />
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Secure access</p>
            <h1 className="text-4xl font-semibold tracking-tight">Manage cleaning operations with clarity.</h1>
            <p className="max-w-md text-sm text-slate-300">
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
            <a href="/" className="font-medium text-slate-900">
              Forgot password
            </a>
          </div>
          {errorMessage ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
          <Button className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
