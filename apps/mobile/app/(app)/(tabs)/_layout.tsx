import { Tabs } from "expo-router";
import { ClipboardList, FileText, House, UserRound } from "lucide-react-native";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function TabLayout() {
  const theme = useAppTheme();
  useRealtimeSync();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", paddingBottom: 7 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <House color={color} size={22} /> }} />
      <Tabs.Screen name="duties" options={{ title: "Duties", tabBarIcon: ({ color }) => <ClipboardList color={color} size={22} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color }) => <FileText color={color} size={22} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <UserRound color={color} size={22} /> }} />
    </Tabs>
  );
}
