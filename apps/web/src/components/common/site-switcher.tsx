import { ChevronDown, Building2, Check } from "lucide-react";
import { useState } from "react";
import { Card } from "../ui/card";
import type { SiteItem } from "../../services/sites-service";

type SiteSwitcherProps = {
  companyName: string;
  activeSite: SiteItem | null;
  sites: SiteItem[];
  onSelectSite: (siteId: string) => void;
};

export function SiteSwitcher({ companyName, activeSite, sites, onSelectSite }: SiteSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="relative flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{companyName}</p>
          <p className="mt-1 text-sm font-semibold">{activeSite?.name ?? "No site selected"}</p>
          <p className="mt-1 text-xs text-slate-500">{activeSite ? "Current site context" : "No sites created yet"}</p>
        </div>
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700"
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={sites.length === 0}
      >
        Switch
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && sites.length > 0 ? (
        <div className="absolute left-4 right-4 top-[calc(100%-0.25rem)] z-20 mt-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
          {sites.map((site) => (
            <button
              key={site.id}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition hover:bg-slate-50"
              onClick={() => {
                onSelectSite(site.id);
                setOpen(false);
              }}
            >
              <span>
                <span className="block font-medium text-slate-950">{site.name}</span>
                <span className="block text-xs text-slate-500">{site.address ?? "No address set"}</span>
              </span>
              {activeSite?.id === site.id ? <Check className="h-4 w-4 text-slate-900" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
