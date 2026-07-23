import type { ReactNode } from "react";
import { Card } from "../ui/card";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export function StatCard({ label, value, detail, accent, active = false, onClick }: StatCardProps) {
  const content = (
    <>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </div>
      {accent ? <div className="rounded-md bg-slate-50 p-3 text-slate-700">{accent}</div> : null}
    </>
  );

  const className = `flex items-start justify-between gap-4 p-5 transition ${
    active ? "ring-2 ring-slate-900" : onClick ? "hover:-translate-y-0.5 hover:shadow-lg" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        <Card className={className}>{content}</Card>
      </button>
    );
  }

  return (
    <Card className={className}>
      {content}
    </Card>
  );
}
