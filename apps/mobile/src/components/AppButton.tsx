import { useAppTheme } from "@/hooks/use-app-theme";
import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";

export function AppButton({ label, icon: Icon, variant = "primary", loading = false, disabled, ...props }: {
  label: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
} & PressableProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const backgroundColor = variant === "primary"
    ? theme.primary
    : variant === "danger"
      ? theme.danger
      : variant === "secondary"
        ? theme.surface
        : "transparent";
  const color = variant === "primary" || variant === "danger" ? "#ffffff" : variant === "ghost" ? theme.muted : theme.ink;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: variant === "secondary" ? theme.border : backgroundColor, opacity: isDisabled ? 0.45 : pressed ? 0.78 : 1 },
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={color} size="small" /> : Icon ? <Icon color={color} size={18} strokeWidth={2} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, paddingHorizontal: 16 },
  label: { fontSize: 15, fontWeight: "700" },
});
