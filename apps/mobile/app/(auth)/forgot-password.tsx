import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { FormField } from "@/components/FormField";
import { useAppTheme } from "@/hooks/use-app-theme";
import { requestPasswordReset } from "@/services/auth-service";

export default function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = z.string().email("Enter a valid email address.").safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(parsed.data);
      setMessage("Check your inbox for the password reset link.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The reset email could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>Reset password</Text>
        <Text style={[styles.copy, { color: theme.muted }]}>We will send a secure link to your account email.</Text>
      </View>
      <FormField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} error={error ?? undefined} />
      {message ? <Text style={[styles.message, { color: theme.success }]}>{message}</Text> : null}
      <AppButton label="Send reset link" loading={loading} onPress={() => void submit()} />
      <Link href="/(auth)/sign-in" style={[styles.link, { color: theme.primary }]}>Back to sign in</Link>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: "center", gap: 17, paddingVertical: 40 },
  header: { marginBottom: 10 },
  title: { fontSize: 30, fontWeight: "800" },
  copy: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  message: { fontSize: 13, fontWeight: "600" },
  link: { textAlign: "center", fontWeight: "700", paddingVertical: 8 },
});
