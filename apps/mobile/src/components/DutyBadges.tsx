import type { DutyPriority, DutyStatus } from "@cleaning-duties/shared";
import { StyleSheet, Text, View } from "react-native";

const statusColors: Record<DutyStatus, { background: string; text: string }> = {
  Draft: { background: "#f2f4f7", text: "#475467" },
  Scheduled: { background: "#eff8ff", text: "#175cd3" },
  Pending: { background: "#fffaeb", text: "#b54708" },
  "In Progress": { background: "#eef4ff", text: "#3538cd" },
  Completed: { background: "#ecfdf3", text: "#067647" },
  Incomplete: { background: "#fff6ed", text: "#c4320a" },
  Missed: { background: "#fef3f2", text: "#b42318" },
  Archived: { background: "#f2f4f7", text: "#667085" },
};

const priorityColors: Record<DutyPriority, { background: string; text: string }> = {
  Urgent: { background: "#fef3f2", text: "#b42318" },
  High: { background: "#fff6ed", text: "#c4320a" },
  Medium: { background: "#fffaeb", text: "#b54708" },
  Low: { background: "#f2f4f7", text: "#475467" },
  Periodical: { background: "#f4f3ff", text: "#5925dc" },
};

function Badge({ label, colors }: { label: string; colors: { background: string; text: string } }) {
  return <View style={[styles.badge, { backgroundColor: colors.background }]}><Text style={[styles.label, { color: colors.text }]}>{label}</Text></View>;
}

export function DutyStatusBadge({ status }: { status: DutyStatus }) {
  return <Badge label={status} colors={statusColors[status]} />;
}

export function PriorityBadge({ priority }: { priority: DutyPriority }) {
  return <Badge label={priority} colors={priorityColors[priority]} />;
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  label: { fontSize: 11, fontWeight: "800" },
});
