import { zodResolver } from "@hookform/resolvers/zod";
import { authLoginSchema, type AuthLoginInput } from "@cleaning-duties/shared";
import { Link } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { FormField } from "@/components/FormField";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useNetwork } from "@/providers/network-provider";
import { signIn } from "@/services/auth-service";

export default function SignInScreen() {
  const theme = useAppTheme();
  const { isOnline } = useNetwork();
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AuthLoginInput>({
    resolver: zodResolver(authLoginSchema),
    defaultValues: { identifier: "", password: "", rememberMe: true },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await signIn(values);
    } catch (error) {
      setError("root", { message: error instanceof Error ? error.message : "Sign in failed." });
    }
  });

  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}><Text style={styles.markText}>CD</Text></View>
        <Text style={[styles.brand, { color: theme.ink }]}>Cleaning Duties</Text>
        <Text style={[styles.title, { color: theme.ink }]}>Welcome back</Text>
        <Text style={[styles.copy, { color: theme.muted }]}>Sign in with the same account you use on the web app.</Text>
      </View>
      <View style={styles.form}>
        <Controller control={control} name="identifier" render={({ field }) => (
          <FormField label="Email or phone" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.identifier?.message} />
        )} />
        <Controller control={control} name="password" render={({ field }) => (
          <FormField label="Password" secureTextEntry value={field.value} onBlur={field.onBlur} onChangeText={field.onChange} error={errors.password?.message} />
        )} />
        {errors.root?.message ? <Text style={[styles.error, { color: theme.danger }]}>{errors.root.message}</Text> : null}
        <AppButton label="Sign in" loading={isSubmitting} disabled={!isOnline} onPress={() => void submit()} />
        <Link href="/(auth)/forgot-password" style={[styles.link, { color: theme.primary }]}>Forgot password?</Link>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: "center", paddingVertical: 40 },
  header: { marginBottom: 30 },
  mark: { width: 46, height: 46, borderRadius: 7, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  markText: { color: "#ffffff", fontWeight: "900", fontSize: 15 },
  brand: { fontSize: 13, fontWeight: "800", marginBottom: 18 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: 0 },
  copy: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  form: { gap: 17 },
  error: { fontSize: 13, lineHeight: 18 },
  link: { textAlign: "center", fontSize: 14, fontWeight: "700", paddingVertical: 8 },
});
