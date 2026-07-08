import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-950 p-6 text-white">{children}</main>;
}
