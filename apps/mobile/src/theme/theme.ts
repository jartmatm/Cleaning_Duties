import { getCompanyPalette } from "@cleaning-duties/shared";

export const systemColors = {
  background: "#f4f6f8",
  surface: "#ffffff",
  ink: "#111827",
  muted: "#667085",
  border: "#dce2e8",
  danger: "#b42318",
  dangerSurface: "#fef3f2",
  success: "#067647",
  successSurface: "#ecfdf3",
  warning: "#b54708",
  warningSurface: "#fffaeb",
};

export function createAppTheme(paletteId: string | null | undefined) {
  const company = getCompanyPalette(paletteId);
  return {
    ...systemColors,
    primary: company.primary,
    accent: company.accent,
    brandSurface: company.surface,
    brandText: company.text,
  };
}

export type AppTheme = ReturnType<typeof createAppTheme>;
