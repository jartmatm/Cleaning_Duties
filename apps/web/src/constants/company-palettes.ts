export type CompanyPalette = {
  id: string;
  name: string;
  primary: string;
  accent: string;
  surface: string;
  text: string;
};

export const companyPalettes: CompanyPalette[] = [
  { id: "midnight", name: "Midnight", primary: "#111827", accent: "#64748b", surface: "#f8fafc", text: "#0f172a" },
  { id: "evergreen", name: "Evergreen", primary: "#14532d", accent: "#65a30d", surface: "#f7fee7", text: "#052e16" },
  { id: "coastal", name: "Coastal", primary: "#0f766e", accent: "#38bdf8", surface: "#ecfeff", text: "#134e4a" },
  { id: "rosewood", name: "Rosewood", primary: "#9f1239", accent: "#fb7185", surface: "#fff1f2", text: "#4c0519" },
  { id: "cobalt", name: "Cobalt", primary: "#1d4ed8", accent: "#60a5fa", surface: "#eff6ff", text: "#172554" },
  { id: "orchard", name: "Orchard", primary: "#166534", accent: "#f59e0b", surface: "#fffbeb", text: "#1c1917" },
  { id: "graphite", name: "Graphite", primary: "#27272a", accent: "#a1a1aa", surface: "#f4f4f5", text: "#18181b" },
  { id: "terracotta", name: "Terracotta", primary: "#9a3412", accent: "#fb923c", surface: "#fff7ed", text: "#431407" },
  { id: "plum", name: "Plum", primary: "#6d2873", accent: "#c084fc", surface: "#faf5ff", text: "#3b0764" },
  { id: "linen", name: "Linen", primary: "#57534e", accent: "#d6d3d1", surface: "#fafaf9", text: "#292524" },
];

export function getCompanyPalette(paletteId: string | null | undefined) {
  return companyPalettes.find((palette) => palette.id === paletteId) ?? companyPalettes[0]!;
}
