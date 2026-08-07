import { DUTY_STATUSES, type DutyStatus } from "@cleaning-duties/shared";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { DutyCard } from "@/components/DutyCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateView";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSession } from "@/providers/session-provider";
import { listDuties } from "@/services/duties-service";

export default function DutiesScreen() {
  const theme = useAppTheme();
  const { profile, activeSite } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DutyStatus | "All">("All");
  const query = useQuery({
    queryKey: ["duties", activeSite?.id, profile?.id, profile?.role],
    queryFn: () => listDuties({ siteId: activeSite!.id, profileId: profile!.id, role: profile!.role }),
    enabled: Boolean(activeSite && profile),
    refetchInterval: 60_000,
  });
  const visible = useMemo(() => (query.data ?? []).filter((duty) => {
    const matchesStatus = status === "All" || duty.status === status;
    const matchesSearch = !search.trim() || duty.title.toLowerCase().includes(search.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  }), [query.data, search, status]);

  return (
    <AppScreen>
      <ScreenHeader eyebrow="Cleaning duties" title={activeSite?.name ?? "Duties"} description="Only work visible to your account and active site is shown." />
      <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}><Search color={theme.muted} size={18} /><TextInput value={search} onChangeText={setSearch} placeholder="Search duties" placeholderTextColor="#98a2b3" style={[styles.searchInput, { color: theme.ink }]} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {["All", ...DUTY_STATUSES].map((item) => {
          const selected = status === item;
          return <Pressable key={item} onPress={() => setStatus(item as DutyStatus | "All")} style={[styles.filter, { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border }]}><Text style={[styles.filterText, { color: selected ? "#ffffff" : theme.ink }]}>{item}</Text></Pressable>;
        })}
      </ScrollView>
      {query.isLoading ? <LoadingState label="Loading duties..." /> : query.error ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : visible.length === 0 ? <EmptyState title="No duties found" description="No real duties match the selected filters." /> : (
        <View style={styles.list}>{visible.map((duty) => <DutyCard key={duty.id} duty={duty} disabled={profile?.role === "Cleaner" && duty.status === "Scheduled"} onPress={() => router.push({ pathname: "/(app)/duty/[id]", params: { id: duty.id } })} />)}</View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, borderWidth: 1, borderRadius: 7, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13 },
  searchInput: { flex: 1, fontSize: 15 },
  filters: { gap: 8, paddingVertical: 14 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: "700" },
  list: { gap: 10, paddingTop: 3 },
});
