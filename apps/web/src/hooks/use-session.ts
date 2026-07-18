import { useSessionStore } from "../store/session-store";

export function useSession() {
  const userId = useSessionStore((state) => state.userId);
  const companyId = useSessionStore((state) => state.companyId);
  const companyName = useSessionStore((state) => state.companyName);
  const companyLogoUrl = useSessionStore((state) => state.companyLogoUrl);
  const companyPalette = useSessionStore((state) => state.companyPalette);
  const activeSiteId = useSessionStore((state) => state.activeSiteId);
  const role = useSessionStore((state) => state.role);
  const email = useSessionStore((state) => state.email);
  const setSession = useSessionStore((state) => state.setSession);
  const setCompanyBranding = useSessionStore((state) => state.setCompanyBranding);
  const setActiveSiteId = useSessionStore((state) => state.setActiveSiteId);
  const setEmail = useSessionStore((state) => state.setEmail);
  const clearSession = useSessionStore((state) => state.clearSession);

  return {
    userId,
    companyId,
    companyName,
    companyLogoUrl,
    companyPalette,
    activeSiteId,
    role,
    email,
    setSession,
    setCompanyBranding,
    setActiveSiteId,
    setEmail,
    clearSession,
  };
}
