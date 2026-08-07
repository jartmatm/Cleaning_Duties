import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, Building2, ChevronRight, CircleAlert, ClipboardPlus, ListTodo } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { DutyCard } from "@/components/DutyCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateView";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSession } from "@/providers/session-provider";
import { listDuties } from "@/services/duties-service";
import { listNotifications } from "@/services/notifications-service";
import { formatDateTime, formatShiftTime } from "@/utils/date";
import { getActiveShift, getShiftDuties } from "@/utils/shift";

export default function HomeScreen() {
  const theme = useAppTheme();
  const { profile, company, activeSite, sites } = useSession();
  const dutiesQuery = useQuery({
    queryKey: ["duties", activeSite?.id, profile?.id, profile?.role],
    queryFn: () => listDuties({ siteId: activeSite!.id, profileId: profile!.id, role: profile!.role }),
    enabled: Boolean(activeSite && profile),
    refetchInterval: 60_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: () => listNotifications(profile!.id),
    enabled: Boolean(profile),
    refetchInterval: 60_000,
  });

  if (!profile) return null;
  if (!activeSite) {
    return <AppScreen><ScreenHeader eyebrow={profile.role} title={company?.name ?? "Cleaning Duties"} /><EmptyState title="No sites assigned" description="Your account does not currently have access to a site." /></AppScreen>;
  }
  if (dutiesQuery.isLoading) return <AppScreen scroll={false}><LoadingState label="Loading this shift..." /></AppScreen>;
  if (dutiesQuery.error) return <AppScreen scroll={false}><ErrorState message={dutiesQuery.error.message} onRetry={() => void dutiesQuery.refetch()} /></AppScreen>;

  const duties = dutiesQuery.data ?? [];
  const shiftDuties = getShiftDuties(duties);
  const activeShift = getActiveShift(duties);
  const counts = {
    pending: shiftDuties.filter((duty) => duty.status === "Pending").length,
    inProgress: shiftDuties.filter((duty) => duty.status === "In Progress").length,
    completed: shiftDuties.filter((duty) => duty.status === "Completed").length,
    missed: duties.filter((duty) => duty.status === "Missed" || duty.status === "Incomplete").length,
  };
  const total = shiftDuties.length;
  const progress = total ? Math.round((counts.completed / total) * 100) : 0;
  const urgent = shiftDuties.filter((duty) => duty.priority === "Urgent");
  const unread = (notificationsQuery.data ?? []).filter((notification) => !notification.readAt).length;

  return (
    <AppScreen refreshControl={undefined}>
      <ScreenHeader
        eyebrow={profile.role}
        title={`Hello, ${profile.fullName.split(" ")[0] ?? profile.fullName}`}
        description={activeShift ? `Current shift ends ${formatDateTime(activeShift.endsAt)}` : "Your next assigned shift is shown below."}
        action={
          <Pressable accessibilityLabel="Open notifications" onPress={() => router.push("/(app)/notifications")} style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Bell color={theme.ink} size={20} />
            {unread > 0 ? <View style={[styles.notificationDot, { backgroundColor: theme.danger }]} /> : null}
          </Pressable>
        }
      />

      <Pressable onPress={() => sites.length > 1 && router.push("/(app)/select-site")} style={[styles.siteBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.siteIcon, { backgroundColor: theme.brandSurface }]}><Building2 color={theme.primary} size={20} /></View>
        <View style={styles.siteCopy}><Text style={[styles.siteLabel, { color: theme.muted }]}>CURRENT SITE</Text><Text numberOfLines={1} style={[styles.siteName, { color: theme.ink }]}>{activeSite.name}</Text></View>
        {sites.length > 1 ? <ChevronRight color={theme.muted} size={19} /> : null}
      </Pressable>

      <View style={styles.shiftHeader}>
        <View><Text style={[styles.sectionTitle, { color: theme.ink }]}>{activeShift ? "Current shift" : "Next shift"}</Text><Text style={[styles.shiftTime, { color: theme.muted }]}>{shiftDuties[0] ? `${formatShiftTime(shiftDuties[0].startsAt)} - ${formatShiftTime(shiftDuties[0].dueDate)}` : `${activeSite.shiftStartTime ?? "--:--"} - ${activeSite.shiftEndTime ?? "--:--"}`}</Text></View>
        <Text style={[styles.progressValue, { color: theme.primary }]}>{counts.completed}/{total}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}><View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress}%` }]} /></View>

      <View style={styles.metrics}>
        <Metric label="In progress" value={counts.inProgress} color={theme.primary} />
        <Metric label="Pending" value={counts.pending} color={theme.warning} />
        <Metric label="Completed" value={counts.completed} color={theme.success} />
        <Metric label="Missed" value={counts.missed} color={theme.danger} />
      </View>

      {urgent.length > 0 ? (
        <View style={[styles.alert, { backgroundColor: theme.dangerSurface }]}><CircleAlert color={theme.danger} size={20} /><Text style={[styles.alertText, { color: theme.danger }]}>{urgent.length} urgent {urgent.length === 1 ? "duty" : "duties"} in this shift</Text></View>
      ) : null}

      <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Shift duties</Text><Pressable onPress={() => router.push("/(app)/(tabs)/duties")}><Text style={[styles.link, { color: theme.primary }]}>View all</Text></Pressable></View>
      <View style={styles.list}>
        {shiftDuties.length === 0 ? <EmptyState title="No duties in this shift" description="The real schedule returned no duties for this shift window." /> : shiftDuties.slice(0, 3).map((duty) => (
          <DutyCard key={duty.id} duty={duty} disabled={profile.role === "Cleaner" && duty.status === "Scheduled"} onPress={() => router.push({ pathname: "/(app)/duty/[id]", params: { id: duty.id } })} />
        ))}
      </View>

      <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: theme.ink }]}>Quick actions</Text></View>
      <View style={styles.actions}>
        {profile.role === "Cleaner" ? <AppButton label="Submit unplanned duty" icon={ClipboardPlus} disabled={!activeShift} onPress={() => router.push("/(app)/unplanned-request/new")} /> : <AppButton label="Review reports" icon={ListTodo} onPress={() => router.push("/(app)/(tabs)/reports")} />}
        <AppButton label="Report incident" icon={CircleAlert} variant="secondary" onPress={() => router.push("/(app)/incident/new")} />
      </View>
    </AppScreen>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  const theme = useAppTheme();
  return <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text numberOfLines={2} style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  notificationDot: { position: "absolute", width: 8, height: 8, borderRadius: 4, top: 8, right: 8 },
  siteBar: { minHeight: 76, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, marginBottom: 27 },
  siteIcon: { width: 44, height: 44, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  siteCopy: { flex: 1, minWidth: 0 },
  siteLabel: { fontSize: 10, fontWeight: "800" },
  siteName: { fontSize: 16, fontWeight: "700", marginTop: 3 },
  shiftHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  shiftTime: { fontSize: 13, marginTop: 4 },
  progressValue: { fontSize: 23, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  metrics: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 20 },
  metric: { flex: 1, minHeight: 82, borderWidth: 1, borderRadius: 7, padding: 10, justifyContent: "space-between" },
  metricValue: { fontSize: 22, fontWeight: "800" },
  metricLabel: { fontSize: 10, lineHeight: 13, fontWeight: "600" },
  alert: { flexDirection: "row", gap: 10, alignItems: "center", borderRadius: 7, padding: 13, marginBottom: 25 },
  alertText: { flex: 1, fontSize: 13, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 13 },
  link: { fontSize: 13, fontWeight: "700" },
  list: { gap: 10, marginBottom: 24 },
  actions: { gap: 10 },
});
