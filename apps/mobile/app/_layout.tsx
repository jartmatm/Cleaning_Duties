import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "@/lib/query-client";
import { NetworkProvider } from "@/providers/network-provider";
import { SessionProvider } from "@/providers/session-provider";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
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
