import { useAppTheme } from "@/hooks/use-app-theme";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "./AppButton";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  const theme = useAppTheme();
  return <View style={styles.state}><LoaderCircle color={theme.primary} size={28} /><Text style={[styles.title, { color: theme.ink }]}>{label}</Text></View>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  const theme = useAppTheme();
  return <View style={styles.state}><Inbox color={theme.muted} size={28} /><Text style={[styles.title, { color: theme.ink }]}>{title}</Text><Text style={[styles.description, { color: theme.muted }]}>{description}</Text></View>;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  const theme = useAppTheme();
  return (
    <View style={styles.state}>
      <AlertCircle color={theme.danger} size={28} />
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.muted }]}>{message}</Text>
      {onRetry ? <AppButton label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { minHeight: 210, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 28, paddingVertical: 24 },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 4 },
});
