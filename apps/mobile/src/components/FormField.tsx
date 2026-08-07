import { useAppTheme } from "@/hooks/use-app-theme";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

export function FormField({ label, error, multiline, ...props }: { label: string; error?: string; multiline?: boolean } & TextInputProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
      <TextInput
        placeholderTextColor="#98a2b3"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: theme.ink, borderColor: error ? theme.danger : theme.border, backgroundColor: theme.surface },
        ]}
        {...props}
      />
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 7 },
  label: { fontSize: 13, fontWeight: "700" },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, fontSize: 16 },
  multiline: { minHeight: 112, paddingTop: 13 },
  error: { fontSize: 12, lineHeight: 17 },
});
