import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateView";
import { useAppTheme } from "@/hooks/use-app-theme";
import { queryClient } from "@/lib/query-client";
import { useSession } from "@/providers/session-provider";
import { listNotifications, markNotificationRead } from "@/services/notifications-service";
import { formatDateTime } from "@/utils/date";

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const { profile } = useSession();
  const query = useQuery({ queryKey: ["notifications", profile?.id], queryFn: () => listNotifications(profile!.id), enabled: Boolean(profile) });
  const mutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", profile?.id] }),
  });
  if (query.isLoading) return <AppScreen safeEdges={["left", "right"]} scroll={false}><LoadingState /></AppScreen>;
  if (query.error) return <AppScreen safeEdges={["left", "right"]} scroll={false}><ErrorState message={query.error.message} onRetry={() => void query.refetch()} /></AppScreen>;
  if (!query.data?.length) return <AppScreen safeEdges={["left", "right"]} scroll={false}><EmptyState title="No notifications" description="Notifications sent to your profile will appear here." /></AppScreen>;

  return (
    <AppScreen safeEdges={["left", "right"]}>
      <View style={styles.list}>{query.data.map((notification) => {
        const title = typeof notification.payload.title === "string" ? notification.payload.title : notification.type.replaceAll("_", " ");
        const dutyId = typeof notification.payload.dutyId === "string" ? notification.payload.dutyId : null;
        return (
          <Pressable key={notification.id} onPress={() => {
            if (!notification.readAt) mutation.mutate(notification.id);
            if (dutyId) router.push({ pathname: "/(app)/duty/[id]", params: { id: dutyId } });
          }} style={[styles.row, { backgroundColor: notification.readAt ? theme.surface : theme.brandSurface, borderColor: theme.border }]}>
            <View style={[styles.icon, { backgroundColor: theme.surface }]}><Bell color={theme.primary} size={18} /></View>
            <View style={styles.copy}><Text style={[styles.title, { color: theme.ink }]}>{title}</Text><Text style={[styles.date, { color: theme.muted }]}>{formatDateTime(notification.createdAt)}</Text></View>
            {!notification.readAt ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
          </Pressable>
        );
      })}</View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 9 },
  row: { minHeight: 76, borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  date: { fontSize: 12, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
