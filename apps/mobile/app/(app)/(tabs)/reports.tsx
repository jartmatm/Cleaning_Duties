import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, FileText, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateView";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppTheme } from "@/hooks/use-app-theme";
import { queryClient } from "@/lib/query-client";
import { useNetwork } from "@/providers/network-provider";
import { useSession } from "@/providers/session-provider";
import { listIncidents } from "@/services/incidents-service";
import { listServiceReports } from "@/services/reports-service";
import { listUnplannedRequests, reviewUnplannedRequest } from "@/services/unplanned-duty-service";
import { formatDate, formatDateTime } from "@/utils/date";

type ReportTab = "Incidents" | "Service reports" | "Unplanned";

export default function ReportsScreen() {
  const theme = useAppTheme();
  const { isOnline } = useNetwork();
  const { profile, activeSite } = useSession();
  const [tab, setTab] = useState<ReportTab>(profile?.role === "Cleaner" ? "Incidents" : "Unplanned");
  const incidents = useQuery({ queryKey: ["incidents", activeSite?.id, profile?.id], queryFn: () => listIncidents({ siteId: activeSite!.id, profileId: profile!.id, cleanerOnly: profile!.role === "Cleaner" }), enabled: Boolean(activeSite && profile) });
  const reports = useQuery({ queryKey: ["service-reports", profile?.companyId, activeSite?.id], queryFn: () => listServiceReports(profile!.companyId, activeSite!.id, profile!.role === "Manager"), enabled: Boolean(activeSite && profile && profile.role !== "Cleaner") });
  const unplanned = useQuery({ queryKey: ["unplanned-requests", activeSite?.id], queryFn: () => listUnplannedRequests(activeSite!.id), enabled: Boolean(activeSite && profile) });
  const review = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) => reviewUnplannedRequest(requestId, approve),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["unplanned-requests", activeSite?.id] }),
        queryClient.invalidateQueries({ queryKey: ["duties", activeSite?.id] }),
      ]);
    },
    onError: (error) => Alert.alert("Request already closed", error.message),
  });
  const tabs: ReportTab[] = profile?.role === "Cleaner" ? ["Incidents", "Unplanned"] : ["Unplanned", "Incidents", "Service reports"];

  if (!activeSite || !profile) return <AppScreen scroll={false}><EmptyState title="No active site" description="Select an assigned site to view reports." /></AppScreen>;
  const activeQuery = tab === "Incidents" ? incidents : tab === "Service reports" ? reports : unplanned;

  return (
    <AppScreen>
      <ScreenHeader eyebrow="Reports" title={activeSite.name} description="Operational records visible to your current role." />
      <View style={styles.tabs}>{tabs.map((item) => {
        const selected = item === tab;
        return <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, { borderBottomColor: selected ? theme.primary : theme.border }]}><Text style={[styles.tabText, { color: selected ? theme.primary : theme.muted }]}>{item}</Text></Pressable>;
      })}</View>
      {activeQuery.isLoading ? <LoadingState /> : activeQuery.error ? <ErrorState message={activeQuery.error.message} onRetry={() => void activeQuery.refetch()} /> : null}

      {tab === "Incidents" && !incidents.isLoading && !incidents.error ? (
        incidents.data?.length ? <View style={styles.list}>{incidents.data.map((incident) => <View key={incident.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.rowHeader}><Text style={[styles.rowTitle, { color: theme.ink }]}>{incident.incidentType}</Text><Text style={[styles.date, { color: theme.muted }]}>{formatDateTime(incident.createdAt)}</Text></View><Text numberOfLines={5} style={[styles.body, { color: theme.muted }]}>{incident.details}</Text></View>)}</View> : <EmptyState title="No incidents" description="No incident reports were returned for this site." />
      ) : null}

      {tab === "Service reports" && !reports.isLoading && !reports.error ? (
        reports.data?.length ? <View style={styles.list}>{reports.data.map((report) => <View key={report.id} style={[styles.row, styles.horizontalRow, { backgroundColor: theme.surface, borderColor: theme.border }]}><FileText color={theme.primary} size={20} /><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.ink }]}>{report.title}</Text><Text style={[styles.date, { color: theme.muted }]}>{formatDate(report.dateFrom)} - {formatDate(report.dateTo)}</Text></View></View>)}</View> : <EmptyState title="No service reports" description="No saved reports are visible for this site." />
      ) : null}

      {tab === "Unplanned" && !unplanned.isLoading && !unplanned.error ? (
        unplanned.data?.length ? <View style={styles.list}>{unplanned.data.map((request) => <View key={request.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.rowHeader}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.ink }]}>{request.title}</Text><Text style={[styles.date, { color: theme.muted }]}>{request.cleanerName} · {formatDateTime(request.reportedCompletedAt)}</Text></View></View><Text style={[styles.body, { color: theme.muted }]}>{request.location}</Text><Text style={[styles.body, { color: theme.muted }]}>{request.description}</Text>{profile.role !== "Cleaner" ? <View style={styles.reviewActions}><View style={styles.action}><AppButton label="Reject" icon={X} variant="danger" disabled={!isOnline} loading={review.isPending} onPress={() => Alert.alert("Reject request?", "The request and its evidence will be deleted.", [{ text: "Cancel", style: "cancel" }, { text: "Reject", style: "destructive", onPress: () => review.mutate({ requestId: request.id, approve: false }) }])} /></View><View style={styles.action}><AppButton label="Approve" icon={Check} disabled={!isOnline} loading={review.isPending} onPress={() => review.mutate({ requestId: request.id, approve: true })} /></View></View> : <Text style={[styles.pending, { color: theme.warning }]}>Waiting for review</Text>}</View>)}</View> : <EmptyState title="No unplanned duties" description={profile.role === "Cleaner" ? "Your pending requests will appear here." : "No extra work is waiting for review."} />
      ) : null}

      <View style={styles.footer}><AppButton label="Report incident" variant="secondary" onPress={() => router.push("/(app)/incident/new")} /></View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", marginBottom: 18 },
  tab: { flex: 1, borderBottomWidth: 2, paddingBottom: 10, alignItems: "center" },
  tabText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  list: { gap: 10 },
  row: { borderWidth: 1, borderRadius: 8, padding: 15, gap: 9 },
  horizontalRow: { flexDirection: "row", alignItems: "flex-start" },
  rowHeader: { flex: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  date: { fontSize: 11, marginTop: 4 },
  body: { fontSize: 13, lineHeight: 19 },
  reviewActions: { flexDirection: "row", gap: 8, marginTop: 5 },
  action: { flex: 1 },
  pending: { fontSize: 12, fontWeight: "700", marginTop: 4 },
  footer: { marginTop: 20 },
});
