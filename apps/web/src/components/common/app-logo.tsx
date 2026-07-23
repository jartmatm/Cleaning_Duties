type AppLogoProps = {
  title?: string;
  subtitle?: string;
  logoUrl?: string | null;
};

export function AppLogo({ title = "Cleaning Duties", subtitle = "Multi-site operations", logoUrl }: AppLogoProps) {
  return (
    <div className="inline-flex items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt={`${title} logo`} className="h-10 w-10 rounded-md border border-[var(--company-border)] object-cover" />
      ) : (
        <div className="h-10 w-10 rounded-md bg-[var(--company-primary)]" />
      )}
      <div>
        <div className="text-sm font-semibold tracking-wide text-[var(--company-text)]">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}
