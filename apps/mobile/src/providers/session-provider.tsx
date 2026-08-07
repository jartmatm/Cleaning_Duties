import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { hasSupabaseConfig } from "@/lib/config";
import { queryClient } from "@/lib/query-client";
import { registerSupabaseAutoRefresh, supabase } from "@/lib/supabase";
import { getCompany, getProfile, listAccessibleSites } from "@/services/session-service";
import type { Company, Profile, Site } from "@/types/domain";

type SessionContextValue = {
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  sites: Site[];
  activeSite: Site | null;
  isLoading: boolean;
  error: string | null;
  setActiveSiteId: (siteId: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function activeSiteKey(userId: string) {
  return `cleaning-duties.mobile.active-site.${userId}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteId, setActiveSiteIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const loadSessionData = useCallback(async (nextSession: Session | null) => {
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setError(null);
    setSession(nextSession);

    if (!nextSession) {
      setProfile(null);
      setCompany(null);
      setSites([]);
      setActiveSiteIdState(null);
      setIsLoading(false);
      return;
    }

    try {
      const nextProfile = await getProfile(nextSession.user.id);
      const [nextCompany, nextSites] = await Promise.all([
        getCompany(nextProfile.companyId),
        listAccessibleSites(nextProfile),
      ]);
      const storedSiteId = await AsyncStorage.getItem(activeSiteKey(nextProfile.id));
      const nextActiveSiteId = nextSites.some((site) => site.id === storedSiteId)
        ? storedSiteId
        : nextSites[0]?.id ?? null;
      if (sequence !== loadSequence.current) return;
      setProfile(nextProfile);
      setCompany(nextCompany);
      setSites(nextSites);
      setActiveSiteIdState(nextActiveSiteId);
      if (nextActiveSiteId) await AsyncStorage.setItem(activeSiteKey(nextProfile.id), nextActiveSiteId);
    } catch (loadError) {
      if (sequence !== loadSequence.current) return;
      setProfile(null);
      setCompany(null);
      setSites([]);
      setActiveSiteIdState(null);
      setError(loadError instanceof Error ? loadError.message : "Your account context could not be loaded.");
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return;
    }
    const unregisterRefresh = registerSupabaseAutoRefresh();
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        setIsLoading(false);
        return;
      }
      void loadSessionData(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadSessionData(nextSession);
    });
    return () => {
      unregisterRefresh();
      listener.subscription.unsubscribe();
    };
  }, [loadSessionData]);

  const setActiveSiteId = useCallback(async (siteId: string) => {
    if (!profile || !sites.some((site) => site.id === siteId)) {
      throw new Error("This site is not assigned to your account.");
    }
    setActiveSiteIdState(siteId);
    await AsyncStorage.setItem(activeSiteKey(profile.id), siteId);
    queryClient.removeQueries({ queryKey: ["duties"] });
  }, [profile, sites]);

  const refresh = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    await loadSessionData(data.session);
  }, [loadSessionData]);

  const signOut = useCallback(async () => {
    const currentProfile = profile;
    await supabase.removeAllChannels();
    queryClient.clear();
    if (currentProfile) await AsyncStorage.removeItem(activeSiteKey(currentProfile.id));
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error(signOutError.message);
  }, [profile]);

  const activeSite = sites.find((site) => site.id === activeSiteId) ?? null;
  const value = useMemo<SessionContextValue>(() => ({
    session,
    profile,
    company,
    sites,
    activeSite,
    isLoading,
    error,
    setActiveSiteId,
    refresh,
    signOut,
  }), [activeSite, company, error, isLoading, profile, refresh, session, setActiveSiteId, signOut, sites]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
