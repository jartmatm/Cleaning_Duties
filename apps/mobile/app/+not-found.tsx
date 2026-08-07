import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function NotFoundScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen scroll={false}>
      <View style={styles.container}>
        <Text style={[styles.code, { color: theme.primary }]}>404</Text>
        <Text style={[styles.title, { color: theme.ink }]}>This screen does not exist.</Text>
        <Link href="/" style={[styles.link, { backgroundColor: theme.primary }]}>Back to home</Link>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  code: { fontSize: 52, fontWeight: "900" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  link: { color: "#ffffff", overflow: "hidden", borderRadius: 7, paddingHorizontal: 18, paddingVertical: 14, fontWeight: "700" },
});
