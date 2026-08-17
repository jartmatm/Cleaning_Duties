import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import type { NotificationClickEvent } from "react-native-onesignal";
import { queryClient } from "@/lib/query-client";
import { NetworkProvider } from "@/providers/network-provider";
import { SessionProvider } from "@/providers/session-provider";
import { oneSignalService } from "@/services/onesignal-service";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  useEffect(() => oneSignalService.initialize((event: NotificationClickEvent) => {
    const data = event.notification.additionalData as { dutyId?: unknown } | undefined;
    if (typeof data?.dutyId === "string") {
      router.push({ pathname: "/(app)/duty/[id]", params: { id: data.dutyId } });
      return;
    }
    if (typeof (data as { requestId?: unknown } | undefined)?.requestId === "string") {
      router.push("/(app)/(tabs)/reports");
      return;
    }
    router.push("/(app)/(tabs)");
  }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f4f6f8" } }} />
        </SessionProvider>
      </NetworkProvider>
    </QueryClientProvider>
  );
}
