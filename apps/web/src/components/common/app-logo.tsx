type AppLogoProps = {
  title?: string;
  subtitle?: string;
};

export function AppLogo({ title = "Cleaning Duties", subtitle = "Multi-site operations" }: AppLogoProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-slate-900" />
      <div>
        <div className="text-sm font-semibold tracking-wide text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}
