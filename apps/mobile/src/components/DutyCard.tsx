import { useAppTheme } from "@/hooks/use-app-theme";
import type { Duty } from "@/types/domain";
import { formatDateTime } from "@/utils/date";
import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DutyStatusBadge, PriorityBadge } from "./DutyBadges";

export function DutyCard({ duty, onPress, disabled = false }: { duty: Duty; onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.surface, opacity: disabled ? 0.58 : pressed ? 0.78 : 1 }]}
    >
      <View style={styles.content}>
        <Text numberOfLines={2} style={[styles.title, { color: theme.ink }]}>{duty.title}</Text>
        <Text style={[styles.date, { color: theme.muted }]}>{formatDateTime(duty.startsAt ?? duty.dueDate) || "No execution date"}</Text>
        <View style={styles.badges}><PriorityBadge priority={duty.priority} /><DutyStatusBadge status={duty.status} /></View>
      </View>
      <ChevronRight color={theme.muted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 112, borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  content: { flex: 1, gap: 7 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  date: { fontSize: 12 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
});
