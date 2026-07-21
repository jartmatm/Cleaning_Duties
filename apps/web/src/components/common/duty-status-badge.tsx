import type { DutyItem } from "../../services/duties-service";

type DutyStatus = DutyItem["status"];

const dutyStatusStyles: Record<DutyStatus, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  "In Progress": "border-sky-200 bg-sky-50 text-sky-800",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Incomplete: "border-rose-200 bg-rose-50 text-rose-800",
  Overdue: "border-red-200 bg-red-50 text-red-800",
};

type DutyStatusBadgeProps = {
  status: DutyStatus;
  className?: string;
};

export function DutyStatusBadge({ status, className = "" }: DutyStatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold ${dutyStatusStyles[status]} ${className}`}
    >
      {status}
    </span>
  );
}
