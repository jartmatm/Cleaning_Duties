import { useSessionStore } from "../store/session-store";

export function useSession() {
  const userId = useSessionStore((state) => state.userId);
  const companyId = useSessionStore((state) => state.companyId);
  const role = useSessionStore((state) => state.role);
  const email = useSessionStore((state) => state.email);
  const setSession = useSessionStore((state) => state.setSession);
  const setEmail = useSessionStore((state) => state.setEmail);
  const clearSession = useSessionStore((state) => state.clearSession);

  return { userId, companyId, role, email, setSession, setEmail, clearSession };
}
