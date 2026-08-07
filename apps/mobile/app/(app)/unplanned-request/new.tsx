import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CheckCircle2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { FormField } from "@/components/FormField";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ErrorState, LoadingState } from "@/components/StateView";
import { useAppTheme } from "@/hooks/use-app-theme";
import { queryClient } from "@/lib/query-client";
import { useNetwork } from "@/providers/network-provider";
import { useSession } from "@/providers/session-provider";
import { listDuties } from "@/services/duties-service";
import type { LocalPhoto } from "@/services/photo-service";
import { submitUnplannedRequest } from "@/services/unplanned-duty-service";
import { formatDateTime } from "@/utils/date";
import { getActiveShift } from "@/utils/shift";

const steps = ["Details", "Evidence", "Review"] as const;

export default function NewUnplannedRequestScreen() {
  const theme = useAppTheme();
  const { isOnline } = useNetwork();
  const { profile, activeSite } = useSession();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<LocalPhoto[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<LocalPhoto[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const dutiesQuery = useQuery({
    queryKey: ["duties", activeSite?.id, profile?.id, profile?.role],
    queryFn: () => listDuties({ siteId: activeSite!.id, profileId: profile!.id, role: profile!.role }),
    enabled: Boolean(activeSite && profile?.role === "Cleaner"),
  });
  const activeShift = useMemo(() => getActiveShift(dutiesQuery.data ?? []), [dutiesQuery.data]);
  const mutation = useMutation({
    mutationFn: () => {
      if (!profile || !activeSite || !activeShift) throw new Error("An active assigned shift is required.");
      return submitUnplannedRequest({ companyId: profile.companyId, siteId: activeSite.id, storageBucket: activeSite.storageBucket, cleanerId: profile.id, shift: activeShift, title, location, description, beforePhotos, afterPhotos });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["unplanned-requests", activeSite?.id] });
      setSubmitted(true);
    },
    onError: (error) => Alert.alert("Request not submitted", error.message),
  });

  function next() {
    if (step === 0) {
      if (title.trim().length < 2 || title.trim().length > 120) return Alert.alert("Check the title", "Use between 2 and 120 characters.");
      if (location.trim().length < 2 || location.trim().length > 240) return Alert.alert("Check the location", "Use between 2 and 240 characters.");
      if (description.trim().length < 2 || description.trim().length > 2000) return Alert.alert("Check the description", "Use between 2 and 2000 characters.");
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  if (dutiesQuery.isLoading) return <AppScreen safeEdges={["left", "right"]} scroll={false}><LoadingState label="Checking active shift..." /></AppScreen>;
  if (dutiesQuery.error) return <AppScreen safeEdges={["left", "right"]} scroll={false}><ErrorState message={dutiesQuery.error.message} onRetry={() => void dutiesQuery.refetch()} /></AppScreen>;
  if (!activeShift) return <AppScreen safeEdges={["left", "right"]} scroll={false}><ErrorState title="No active shift" message="Unplanned duties can only be submitted while one of your assigned shifts is active." /></AppScreen>;
  if (submitted) {
    return <AppScreen safeEdges={["left", "right"]} scroll={false}><View style={styles.success}><View style={[styles.successIcon, { backgroundColor: theme.successSurface }]}><CheckCircle2 color={theme.success} size={40} /></View><Text style={[styles.successTitle, { color: theme.ink }]}>Sent for review</Text><Text style={[styles.successCopy, { color: theme.muted }]}>A manager or supervisor can now approve this completed work.</Text><AppButton label="Return home" onPress={() => router.replace("/(app)/(tabs)")} /></View></AppScreen>;
  }

  return (
    <AppScreen safeEdges={["left", "right"]} contentContainerStyle={styles.screen}>
      <View style={styles.stepHeader}><Text style={[styles.stepLabel, { color: theme.primary }]}>STEP {step + 1} OF {steps.length}</Text><Text style={[styles.title, { color: theme.ink }]}>{steps[step]}</Text><Text style={[styles.shift, { color: theme.muted }]}>{formatDateTime(activeShift.startsAt)} - {formatDateTime(activeShift.endsAt)}</Text></View>
      <View style={[styles.progress, { backgroundColor: theme.border }]}><View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${((step + 1) / steps.length) * 100}%` }]} /></View>

      {step === 0 ? <View style={styles.body}><FormField label="What did you do?" value={title} onChangeText={setTitle} placeholder="For example: Cleaned an unexpected spill" /><FormField label="Location" value={location} onChangeText={setLocation} placeholder="Area, room or level" /><FormField label="Description" multiline value={description} onChangeText={setDescription} placeholder="Describe the extra work you completed." /></View> : null}
      {step === 1 ? <View style={styles.body}><Text style={[styles.copy, { color: theme.muted }]}>Photos are optional. Add any evidence you captured before or after the work.</Text><PhotoPicker label="Before photos" photos={beforePhotos} onChange={setBeforePhotos} disabled={!isOnline} /><PhotoPicker label="After photos" photos={afterPhotos} onChange={setAfterPhotos} disabled={!isOnline} /></View> : null}
      {step === 2 ? <View style={styles.body}><Review label="Title" value={title} /><Review label="Location" value={location} /><Review label="Description" value={description} /><Text style={[styles.reviewLabel, { color: theme.muted }]}>EVIDENCE</Text><View style={styles.previewRow}>{[...beforePhotos, ...afterPhotos].map((photo, index) => <Image key={`${photo.uri}-${index}`} source={{ uri: photo.uri }} style={styles.preview} />)}{beforePhotos.length + afterPhotos.length === 0 ? <Text style={[styles.copy, { color: theme.muted }]}>No photos attached.</Text> : null}</View><Text style={[styles.notice, { color: theme.muted }]}>Submitting sends this completed work to your manager and supervisors for approval.</Text></View> : null}

      <View style={styles.footer}>{step > 0 ? <View style={styles.footerButton}><AppButton label="Back" variant="secondary" onPress={() => setStep((current) => Math.max(0, current - 1))} /></View> : <View style={styles.footerButton}><AppButton label="Cancel" variant="ghost" onPress={() => router.back()} /></View>}<View style={styles.footerButton}>{step < steps.length - 1 ? <AppButton label="Next" onPress={next} /> : <AppButton label="Submit" loading={mutation.isPending} disabled={!isOnline} onPress={() => mutation.mutate()} />}</View></View>
    </AppScreen>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return <View style={styles.review}><Text style={[styles.reviewLabel, { color: theme.muted }]}>{label.toUpperCase()}</Text><Text style={[styles.reviewValue, { color: theme.ink }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1 },
  stepHeader: { marginBottom: 14 },
  stepLabel: { fontSize: 11, fontWeight: "800", marginBottom: 7 },
  title: { fontSize: 30, fontWeight: "800" },
  shift: { fontSize: 12, marginTop: 7 },
  progress: { height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 28 },
  progressFill: { height: "100%" },
  body: { flex: 1, gap: 18 },
  copy: { fontSize: 14, lineHeight: 21 },
  review: { gap: 5 },
  reviewLabel: { fontSize: 10, fontWeight: "800" },
  reviewValue: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  previewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preview: { width: 78, height: 104, borderRadius: 7 },
  notice: { fontSize: 13, lineHeight: 19, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dce2e8", paddingTop: 15 },
  footer: { flexDirection: "row", gap: 10, paddingTop: 28 },
  footerButton: { flex: 1 },
  success: { flex: 1, justifyContent: "center", alignItems: "center", gap: 13, paddingHorizontal: 20 },
  successIcon: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  successTitle: { fontSize: 27, fontWeight: "800" },
  successCopy: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 10 },
});
