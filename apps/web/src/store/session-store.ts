import { create } from "zustand";

type SessionState = {
  userId: string | null;
  companyId: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyPalette: string | null;
  activeSiteId: string | null;
  role: "Owner" | "Manager" | "Cleaner" | null;
  email: string | null;
  isSessionLoading: boolean;
  setSession: (session: {
    userId: string;
    companyId: string;
    companyName: string | null;
    companyLogoUrl?: string | null;
    companyPalette?: string | null;
    role: "Owner" | "Manager" | "Cleaner";
  }) => void;
  setCompanyBranding: (branding: { companyName: string | null; companyLogoUrl: string | null; companyPalette: string | null }) => void;
  setActiveSiteId: (siteId: string | null) => void;
  setEmail: (email: string | null) => void;
  setSessionLoading: (isSessionLoading: boolean) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  companyId: null,
  companyName: null,
  companyLogoUrl: null,
  companyPalette: null,
  activeSiteId: null,
  role: null,
  email: null,
  isSessionLoading: true,
  setSession: (session) =>
    set({
      userId: session.userId,
      companyId: session.companyId,
      companyName: session.companyName,
      companyLogoUrl: session.companyLogoUrl ?? null,
      companyPalette: session.companyPalette ?? null,
      role: session.role,
      isSessionLoading: false,
    }),
  setCompanyBranding: (branding) => set({ companyName: branding.companyName, companyLogoUrl: branding.companyLogoUrl, companyPalette: branding.companyPalette }),
  setActiveSiteId: (activeSiteId) => set({ activeSiteId }),
  setEmail: (email) => set({ email }),
  setSessionLoading: (isSessionLoading) => set({ isSessionLoading }),
  clearSession: () =>
    set({
      userId: null,
      companyId: null,
      companyName: null,
      companyLogoUrl: null,
      companyPalette: null,
      activeSiteId: null,
      role: null,
      email: null,
      isSessionLoading: false,
    }),
}));
