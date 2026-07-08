import { ChevronDown, Building2 } from "lucide-react";
import { Card } from "../ui/card";

export function SiteSwitcher() {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Active site</p>
          <p className="mt-1 text-sm font-semibold">North Tower</p>
        </div>
      </div>
      <button className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
        Switch
        <ChevronDown className="h-4 w-4" />
      </button>
    </Card>
  );
}
