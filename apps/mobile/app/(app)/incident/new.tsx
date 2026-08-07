import { INCIDENT_TYPES, type IncidentType } from "@cleaning-duties/shared";
import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { FormField } from "@/components/FormField";
import { useAppTheme } from "@/hooks/use-app-theme";
import { queryClient } from "@/lib/query-client";
import { useNetwork } from "@/providers/network-provider";
import { useSession } from "@/providers/session-provider";
import { createIncident } from "@/services/incidents-service";

export default function NewIncidentScreen() {
  const { dutyId } = useLocalSearchParams<{ dutyId?: string }>();
  const theme = useAppTheme();
  const { isOnline } = useNetwork();
  const { profile, activeSite } = useSession();
  const [incidentType, setIncidentType] = useState<IncidentType>(INCIDENT_TYPES[0]);
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [injuryOrDamage, setInjuryOrDamage] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      if (!profile || !activeSite) throw new Error("Your site context is unavailable.");
      if (!location.trim() || !summary.trim() || !immediateAction.trim() || !injuryOrDamage.trim()) throw new Error("Complete every incident field before submitting.");
      return createIncident({ siteId: activeSite.id, reportedBy: profile.id, dutyId: dutyId ?? null, incidentType, occurredAt: new Date().toISOString(), location, summary, immediateAction, injuryOrDamage });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["incidents", activeSite?.id] });
      router.back();
    },
    onError: (error) => Alert.alert("Incident not submitted", error.message),
  });

  return (
    <AppScreen safeEdges={["left", "right"]}>
      <Text style={[styles.intro, { color: theme.muted }]}>The incident will be recorded against {activeSite?.name ?? "your active site"}{dutyId ? " and this duty" : ""}.</Text>
      <Text style={[styles.label, { color: theme.ink }]}>Incident type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types}>{INCIDENT_TYPES.map((item) => {
        const selected = item === incidentType;
        return <Pressable key={item} onPress={() => setIncidentType(item)} style={[styles.type, { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border }]}><Text style={[styles.typeText, { color: selected ? "#ffffff" : theme.ink }]}>{item}</Text></Pressable>;
      })}</ScrollView>
      <View style={styles.form}>
        <FormField label="Location or area" value={location} onChangeText={setLocation} />
        <FormField label="What happened?" multiline value={summary} onChangeText={setSummary} />
        <FormField label="Immediate action taken" multiline value={immediateAction} onChangeText={setImmediateAction} />
        <FormField label="Injury or damage" multiline value={injuryOrDamage} onChangeText={setInjuryOrDamage} placeholder="Write None if there was no injury or damage." />
        <AppButton label="Submit incident" loading={mutation.isPending} disabled={!isOnline} onPress={() => mutation.mutate()} />
        <AppButton label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "700" },
  types: { gap: 8, paddingVertical: 11, paddingBottom: 20 },
  type: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  typeText: { fontSize: 12, fontWeight: "700" },
  form: { gap: 17 },
});
