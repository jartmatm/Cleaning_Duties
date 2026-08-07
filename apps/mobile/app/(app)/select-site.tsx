import { router } from "expo-router";
import { Check, MapPin } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { EmptyState } from "@/components/StateView";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSession } from "@/providers/session-provider";

export default function SelectSiteScreen() {
  const theme = useAppTheme();
  const { sites, activeSite, setActiveSiteId } = useSession();
  return (
    <AppScreen safeEdges={["left", "right"]}>
      {sites.length === 0 ? <EmptyState title="No sites available" description="Your account is not assigned to any sites." /> : (
        <View style={styles.list}>{sites.map((site) => {
          const selected = site.id === activeSite?.id;
          return (
            <Pressable key={site.id} onPress={() => void setActiveSiteId(site.id).then(() => router.back())} style={[styles.row, { backgroundColor: theme.surface, borderColor: selected ? theme.primary : theme.border }]}>
              <MapPin color={selected ? theme.primary : theme.muted} size={20} />
              <View style={styles.copy}><Text style={[styles.name, { color: theme.ink }]}>{site.name}</Text><Text numberOfLines={2} style={[styles.address, { color: theme.muted }]}>{site.address || "No address provided"}</Text></View>
              {selected ? <Check color={theme.primary} size={20} /> : null}
            </Pressable>
          );
        })}</View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { minHeight: 78, borderWidth: 1, borderRadius: 8, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700" },
  address: { fontSize: 13, lineHeight: 18, marginTop: 4 },
});
