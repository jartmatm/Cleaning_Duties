import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AppLogo } from "../components/common/app-logo";
import { MobileNav } from "../components/common/mobile-nav";
import { SiteSwitcher } from "../components/common/site-switcher";
import { Button } from "../components/ui/button";
import { signOut } from "../services/auth-service";
import { useSession } from "../hooks/use-session";
import { navigationItems } from "../constants/navigation";
import { useQuery } from "@tanstack/react-query";
import { listSites } from "../services/sites-service";
import { getCompanyPalette } from "../constants/company-palettes";

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { email, role, companyId, companyName, companyLogoUrl, companyPalette, activeSiteId, setActiveSiteId } = useSession();
  const { data: sites = [] } = useQuery({
    queryKey: ["layout-sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null;
  const palette = getCompanyPalette(companyPalette);

  useEffect(() => {
    const firstSite = sites[0];
    if (!activeSiteId && firstSite) {
      setActiveSiteId(firstSite.id);
    }
  }, [activeSiteId, setActiveSiteId, sites]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-4 pb-24 lg:px-6 lg:py-6 lg:pb-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-72 flex-col justify-between rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:flex">
          <div className="space-y-8">
            <AppLogo title={companyName ?? "Cleaning Duties"} subtitle={activeSite?.name ?? "No site selected"} logoUrl={companyLogoUrl} />
            <nav className="space-y-2 text-sm">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                        isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
              <p className="font-medium text-slate-900">{email ?? "Not signed in"}</p>
              <p className="mt-1">{role ?? "Cleaner"}</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              Logout
            </Button>
          </div>
        </aside>

        <main className="flex-1 space-y-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:p-8">
          <div className="flex items-center justify-between gap-4 lg:hidden">
            <AppLogo title={companyName ?? "Cleaning Duties"} subtitle={activeSite?.name ?? "No site selected"} logoUrl={companyLogoUrl} />
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              Logout
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SiteSwitcher
              companyName={companyName ?? "Cleaning Duties"}
              activeSite={activeSite}
              sites={sites}
              onSelectSite={setActiveSiteId}
            />
            <div className="rounded-[2rem] p-5 text-white" style={{ backgroundColor: palette.primary }}>
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">Current context</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{activeSite?.name ?? "No active site"}</p>
              <p className="mt-2 text-sm text-white/75">
                {sites.length > 0
                  ? `${sites.length} site${sites.length === 1 ? "" : "s"} available in this company`
                  : "Create a site to start assigning duties and cleaners."}
              </p>
            </div>
          </div>

          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
