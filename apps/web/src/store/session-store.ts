import { create } from "zustand";

type SessionState = {
  userId: string | null;
  companyId: string | null;
  companyName: string | null;
  activeSiteId: string | null;
  role: "Owner" | "Manager" | "Cleaner" | null;
  email: string | null;
  setSession: (session: { userId: string; companyId: string; companyName: string | null; role: "Owner" | "Manager" | "Cleaner" }) => void;
  setActiveSiteId: (siteId: string | null) => void;
  setEmail: (email: string | null) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  companyId: null,
  companyName: null,
  activeSiteId: null,
  role: null,
  email: null,
  setSession: (session) => set({ userId: session.userId, companyId: session.companyId, companyName: session.companyName, role: session.role }),
  setActiveSiteId: (activeSiteId) => set({ activeSiteId }),
  setEmail: (email) => set({ email }),
  clearSession: () => set({ userId: null, companyId: null, companyName: null, activeSiteId: null, role: null, email: null }),
}));
