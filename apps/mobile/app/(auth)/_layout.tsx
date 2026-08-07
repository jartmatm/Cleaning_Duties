import { Redirect, Stack } from "expo-router";
import { LoadingState } from "@/components/StateView";
import { AppScreen } from "@/components/AppScreen";
import { useSession } from "@/providers/session-provider";

export default function AuthLayout() {
  const { session, isLoading } = useSession();
  if (isLoading) return <AppScreen scroll={false}><LoadingState /></AppScreen>;
  if (session) return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
