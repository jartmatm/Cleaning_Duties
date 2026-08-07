import { useEffect } from "react";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/session-provider";

export function useRealtimeSync() {
  const { profile, activeSite } = useSession();

  useEffect(() => {
    if (!profile || !activeSite) return;
    const channel = supabase
      .channel(`mobile-sync-${profile.id}-${activeSite.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cleaning_duties", filter: `site_id=eq.${activeSite.id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["duties", activeSite.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "duty_assignments", filter: `profile_id=eq.${profile.id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["duties", activeSite.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `profile_id=eq.${profile.id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["notifications", profile.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "unplanned_duty_requests", filter: `site_id=eq.${activeSite.id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["unplanned-requests", activeSite.id] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeSite, profile]);
}
