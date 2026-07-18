type AppLogoProps = {
  title?: string;
  subtitle?: string;
  logoUrl?: string | null;
};

export function AppLogo({ title = "Cleaning Duties", subtitle = "Multi-site operations", logoUrl }: AppLogoProps) {
  return (
    <div className="inline-flex items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt={`${title} logo`} className="h-10 w-10 rounded-2xl border border-slate-200 object-cover" />
      ) : (
        <div className="h-10 w-10 rounded-2xl bg-slate-900" />
      )}
      <div>
        <div className="text-sm font-semibold tracking-wide text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}
