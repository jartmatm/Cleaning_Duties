import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { ErrorState, LoadingState } from "@/components/StateView";
import { hasSupabaseConfig, missingSupabaseVariables } from "@/lib/config";
import { useSession } from "@/providers/session-provider";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function IndexScreen() {
  const theme = useAppTheme();
  const { session, profile, isLoading, error, refresh, signOut } = useSession();

  if (!hasSupabaseConfig) {
    return (
      <AppScreen scroll={false}>
        <View style={styles.center}>
          <Text style={[styles.brand, { color: theme.ink }]}>Cleaning Duties</Text>
          <Text style={[styles.title, { color: theme.ink }]}>Mobile configuration required</Text>
          <Text style={[styles.copy, { color: theme.muted }]}>Add the public Supabase values to apps/mobile/.env, then restart Expo.</Text>
          <View style={[styles.code, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {missingSupabaseVariables.map((variable) => <Text key={variable} style={[styles.variable, { color: theme.ink }]}>{variable}</Text>)}
          </View>
        </View>
      </AppScreen>
    );
  }
  if (isLoading) return <AppScreen scroll={false}><LoadingState label="Restoring your session..." /></AppScreen>;
  if (session && error) {
    return <AppScreen scroll={false}><ErrorState title="Account setup incomplete" message={error} onRetry={() => void refresh()} /><AppButton label="Sign out" variant="ghost" onPress={() => void signOut()} /></AppScreen>;
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile) return <AppScreen scroll={false}><ErrorState message="Your authenticated account does not have an accessible profile." /></AppScreen>;
  return <Redirect href="/(app)/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", gap: 13 },
  brand: { fontSize: 14, fontWeight: "800" },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800" },
  copy: { fontSize: 15, lineHeight: 22 },
  code: { marginTop: 8, borderWidth: 1, borderRadius: 7, padding: 15, gap: 8 },
  variable: { fontFamily: "Courier", fontSize: 12 },
});
