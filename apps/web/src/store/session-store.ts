import { create } from "zustand";

type SessionState = {
  userId: string | null;
  companyId: string | null;
  role: "Owner" | "Manager" | "Cleaner" | null;
  email: string | null;
  setSession: (session: { userId: string; companyId: string; role: "Owner" | "Manager" | "Cleaner" }) => void;
  setEmail: (email: string | null) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  companyId: null,
  role: null,
  email: null,
  setSession: (session) => set({ userId: session.userId, companyId: session.companyId, role: session.role }),
  setEmail: (email) => set({ email }),
  clearSession: () => set({ userId: null, companyId: null, role: null, email: null }),
}));
