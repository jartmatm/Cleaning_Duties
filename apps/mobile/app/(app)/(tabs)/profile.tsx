import { Building2, Check, LogOut, MapPin, UserRound } from "lucide-react-native";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSession } from "@/providers/session-provider";

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { profile, company, sites, activeSite, signOut } = useSession();
  if (!profile) return null;
  return (
    <AppScreen>
      <ScreenHeader eyebrow="Profile" title={profile.fullName} description={profile.role} />
      <View style={[styles.identity, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {company?.logoUrl ? <Image source={{ uri: company.logoUrl }} style={styles.logo} /> : <View style={[styles.avatar, { backgroundColor: theme.brandSurface }]}><UserRound color={theme.primary} size={28} /></View>}
        <View style={styles.identityCopy}><Text style={[styles.company, { color: theme.ink }]}>{company?.name ?? "Company unavailable"}</Text><Text style={[styles.email, { color: theme.muted }]}>{profile.email ?? "No email in profile"}</Text><Text style={[styles.email, { color: theme.muted }]}>{profile.phone ?? "No phone in profile"}</Text></View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.ink }]}>Assigned sites</Text>
      <View style={styles.sites}>{sites.map((site) => <View key={site.id} style={[styles.site, { borderColor: theme.border, backgroundColor: theme.surface }]}><MapPin color={theme.muted} size={19} /><View style={styles.siteCopy}><Text style={[styles.siteName, { color: theme.ink }]}>{site.name}</Text><Text style={[styles.siteAddress, { color: theme.muted }]}>{site.address || "No address provided"}</Text></View>{site.id === activeSite?.id ? <Check color={theme.success} size={19} /> : null}</View>)}</View>

      <View style={[styles.roleInfo, { backgroundColor: theme.brandSurface }]}><Building2 color={theme.primary} size={20} /><Text style={[styles.roleText, { color: theme.brandText }]}>{profile.role === "Manager" ? "Full company access" : profile.role === "Supervisor" ? "Access to assigned sites" : "Access to assigned duties"}</Text></View>
      <View style={styles.signOut}><AppButton label="Sign out" icon={LogOut} variant="secondary" onPress={() => Alert.alert("Sign out?", "Cached account data will be cleared from this device.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => void signOut() }])} /></View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 26 },
  avatar: { width: 54, height: 54, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  logo: { width: 54, height: 54, borderRadius: 7, resizeMode: "contain" },
  identityCopy: { flex: 1 },
  company: { fontSize: 16, fontWeight: "800" },
  email: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  sites: { gap: 9 },
  site: { borderWidth: 1, borderRadius: 7, minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, padding: 13 },
  siteCopy: { flex: 1 },
  siteName: { fontSize: 14, fontWeight: "700" },
  siteAddress: { fontSize: 12, marginTop: 3 },
  roleInfo: { borderRadius: 7, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  roleText: { fontSize: 13, fontWeight: "700" },
  signOut: { marginTop: 28 },
});
