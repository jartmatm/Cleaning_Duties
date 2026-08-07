import { Redirect, Stack } from "expo-router";
import { AppScreen } from "@/components/AppScreen";
import { ErrorState, LoadingState } from "@/components/StateView";
import { useSession } from "@/providers/session-provider";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function ProtectedLayout() {
  const theme = useAppTheme();
  const { session, profile, isLoading, error, refresh } = useSession();
  if (isLoading) return <AppScreen scroll={false}><LoadingState label="Loading your workspace..." /></AppScreen>;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!profile || error) return <AppScreen scroll={false}><ErrorState title="Account unavailable" message={error ?? "Your profile could not be loaded."} onRetry={() => void refresh()} /></AppScreen>;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.ink,
        headerShadowVisible: false,
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="select-site" options={{ title: "Select site", presentation: "modal" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="duty/[id]" options={{ title: "Duty details" }} />
      <Stack.Screen name="incident/new" options={{ title: "Report incident", presentation: "modal" }} />
      <Stack.Screen name="unplanned-request/new" options={{ title: "Unplanned duty", presentation: "fullScreenModal" }} />
    </Stack>
  );
}
