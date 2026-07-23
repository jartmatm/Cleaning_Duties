import type { ReactNode } from "react";
import { Card } from "../ui/card";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: ReactNode;
};

export function StatCard({ label, value, detail, accent }: StatCardProps) {
  return (
    <Card className="flex items-start justify-between gap-4 p-5">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </div>
      {accent ? <div className="rounded-md bg-slate-50 p-3 text-slate-700">{accent}</div> : null}
    </Card>
  );
}
