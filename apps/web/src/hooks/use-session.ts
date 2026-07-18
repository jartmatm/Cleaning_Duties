import { useSessionStore } from "../store/session-store";

export function useSession() {
  const userId = useSessionStore((state) => state.userId);
  const companyId = useSessionStore((state) => state.companyId);
  const companyName = useSessionStore((state) => state.companyName);
  const activeSiteId = useSessionStore((state) => state.activeSiteId);
  const role = useSessionStore((state) => state.role);
  const email = useSessionStore((state) => state.email);
  const setSession = useSessionStore((state) => state.setSession);
  const setActiveSiteId = useSessionStore((state) => state.setActiveSiteId);
  const setEmail = useSessionStore((state) => state.setEmail);
  const clearSession = useSessionStore((state) => state.clearSession);

  return { userId, companyId, companyName, activeSiteId, role, email, setSession, setActiveSiteId, setEmail, clearSession };
}
