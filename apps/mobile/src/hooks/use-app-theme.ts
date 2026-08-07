import { useMemo } from "react";
import { useSession } from "@/providers/session-provider";
import { createAppTheme } from "@/theme/theme";

export function useAppTheme() {
  const { company } = useSession();
  return useMemo(() => createAppTheme(company?.colorPalette), [company?.colorPalette]);
}
