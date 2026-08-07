import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { FormField } from "@/components/FormField";
import { useAppTheme } from "@/hooks/use-app-theme";
import { updatePassword } from "@/services/auth-service";

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    setError(null);
    try {
      await updatePassword(password);
      setMessage("Your password was updated. You can return to the app.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The password could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <Text style={[styles.title, { color: theme.ink }]}>Choose a new password</Text>
      <FormField label="New password" secureTextEntry value={password} onChangeText={setPassword} />
      <FormField label="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} error={error ?? undefined} />
      {message ? <Text style={{ color: theme.success }}>{message}</Text> : null}
      <AppButton label="Update password" loading={loading} onPress={() => void submit()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: "center", gap: 17, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 10 },
});
