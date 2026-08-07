import { useAppTheme } from "@/hooks/use-app-theme";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

export function ScreenHeader({ eyebrow, title, description, action, style }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  style?: ViewStyle;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: theme.muted }]}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0, marginBottom: 7 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: 0 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 7 },
});
