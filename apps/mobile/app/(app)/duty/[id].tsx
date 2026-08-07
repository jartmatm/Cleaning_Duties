import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, CircleAlert, Play, Send } from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppScreen } from "@/components/AppScreen";
import { DutyStatusBadge, PriorityBadge } from "@/components/DutyBadges";
import { FormField } from "@/components/FormField";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ErrorState, LoadingState } from "@/components/StateView";
import { useAppTheme } from "@/hooks/use-app-theme";
import { queryClient } from "@/lib/query-client";
import { useNetwork } from "@/providers/network-provider";
import { useSession } from "@/providers/session-provider";
import { addDutyComment, getDutyDetail, saveDutyEvidence, transitionDuty } from "@/services/duties-service";
import { uploadDutyPhotos, type LocalPhoto } from "@/services/photo-service";
import { formatDateTime } from "@/utils/date";

export default function DutyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const { isOnline } = useNetwork();
  const { profile, sites } = useSession();
  const [comment, setComment] = useState("");
  const [beforePhotos, setBeforePhotos] = useState<LocalPhoto[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<LocalPhoto[]>([]);
  const query = useQuery({ queryKey: ["duty", id], queryFn: () => getDutyDetail(id), enabled: Boolean(id) });
  const duty = query.data;
  const site = sites.find((item) => item.id === duty?.siteId) ?? null;

  const startMutation = useMutation({
    mutationFn: () => transitionDuty(duty!, "In Progress", profile!.role),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["duty", id] }),
        queryClient.invalidateQueries({ queryKey: ["duties", duty?.siteId] }),
      ]);
    },
    onError: (error) => Alert.alert("Duty could not be started", error.message),
  });

  const commentMutation = useMutation({
    mutationFn: () => addDutyComment(id, profile!.id, comment),
    onSuccess: async () => {
      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["duty", id] });
    },
    onError: (error) => Alert.alert("Comment not saved", error.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!duty || !site || !profile) throw new Error("Duty context is incomplete.");
      const newBeforeUrls = beforePhotos.length ? await uploadDutyPhotos({ bucketName: site.storageBucket, siteId: site.id, dutyTitle: duty.title, type: "before", photos: beforePhotos }) : [];
      const newAfterUrls = afterPhotos.length ? await uploadDutyPhotos({ bucketName: site.storageBucket, siteId: site.id, dutyTitle: duty.title, type: "after", photos: afterPhotos }) : [];
      if (newBeforeUrls.length || newAfterUrls.length) {
        await saveDutyEvidence(duty.id, [...duty.beforePhotos, ...newBeforeUrls], [...duty.afterPhotos, ...newAfterUrls]);
      }
      await addDutyComment(duty.id, profile.id, comment);
      return transitionDuty(duty, "Completed", profile.role);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["duty", id] }),
        queryClient.invalidateQueries({ queryKey: ["duties", duty?.siteId] }),
      ]);
      router.back();
    },
    onError: (error) => Alert.alert("Duty could not be completed", error.message),
  });

  if (query.isLoading) return <AppScreen scroll={false}><LoadingState label="Loading duty..." /></AppScreen>;
  if (query.error || !duty) return <AppScreen scroll={false}><ErrorState message={query.error?.message ?? "Duty not found."} onRetry={() => void query.refetch()} /></AppScreen>;

  const canStart = profile?.role === "Cleaner" && duty.status === "Pending";
  const canComplete = profile?.role === "Cleaner" && duty.status === "In Progress";
  const canComment = Boolean(profile) && !["Archived", "Missed"].includes(duty.status);

  return (
    <AppScreen safeEdges={["left", "right"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>{duty.title}</Text>
        <View style={styles.badges}><PriorityBadge priority={duty.priority} /><DutyStatusBadge status={duty.status} /></View>
      </View>
      <View style={[styles.meta, { borderColor: theme.border }]}>
        <Meta label="Execution" value={formatDateTime(duty.startsAt ?? duty.dueDate) || "Not scheduled"} />
        <Meta label="Site" value={site?.name ?? "Assigned site"} />
        <Meta label="Assigned" value={duty.assignedUsers.map((user) => user.name).join(", ") || "Not assigned"} />
      </View>
      <Section title="Instructions"><Text style={[styles.body, { color: theme.muted }]}>{duty.description || "No description provided."}</Text></Section>
      <Section title="Equipment"><Text style={[styles.body, { color: theme.muted }]}>{duty.equipment.join(", ") || "No equipment listed."}</Text></Section>
      {duty.referencePhotos.length > 0 ? <PhotoStrip title="Reference photos" urls={duty.referencePhotos} /> : null}
      {duty.beforePhotos.length > 0 ? <PhotoStrip title="Before evidence" urls={duty.beforePhotos} /> : null}
      {duty.afterPhotos.length > 0 ? <PhotoStrip title="After evidence" urls={duty.afterPhotos} /> : null}

      {canComplete ? (
        <View style={styles.evidence}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Completion evidence</Text>
          <PhotoPicker label="Before photos" photos={beforePhotos} onChange={setBeforePhotos} disabled={!isOnline} />
          <PhotoPicker label="After photos" photos={afterPhotos} onChange={setAfterPhotos} disabled={!isOnline} />
        </View>
      ) : null}

      {canComment ? <FormField label="Comment" multiline value={comment} onChangeText={setComment} placeholder="Add an update or completion note." /> : null}
      {canComment && comment.trim() && !canComplete ? <AppButton label="Add comment" icon={Send} variant="secondary" loading={commentMutation.isPending} disabled={!isOnline} onPress={() => commentMutation.mutate()} /> : null}

      {duty.comments.length > 0 ? (
        <Section title="Comments">
          <View style={styles.commentList}>{duty.comments.map((item) => <View key={item.id} style={[styles.comment, { borderColor: theme.border }]}><Text style={[styles.commentAuthor, { color: theme.ink }]}>{item.authorName}</Text><Text style={[styles.body, { color: theme.muted }]}>{item.body}</Text><Text style={[styles.commentDate, { color: theme.muted }]}>{formatDateTime(item.createdAt)}</Text></View>)}</View>
        </Section>
      ) : null}

      {duty.incidents.length > 0 ? <Section title="Related incidents"><Text style={[styles.body, { color: theme.danger }]}>{duty.incidents.length} incident {duty.incidents.length === 1 ? "report" : "reports"}</Text></Section> : null}
      <View style={styles.actions}>
        {canStart ? <AppButton label="Start duty" icon={Play} loading={startMutation.isPending} disabled={!isOnline} onPress={() => startMutation.mutate()} /> : null}
        {canComplete ? <AppButton label="Complete duty" icon={CheckCircle2} loading={completeMutation.isPending} disabled={!isOnline} onPress={() => completeMutation.mutate()} /> : null}
        {!canStart && !canComplete && profile?.role === "Cleaner" ? <Text style={[styles.readOnly, { color: theme.muted }]}>This duty is read-only in its current status.</Text> : null}
        <AppButton label="Report incident" icon={CircleAlert} variant="secondary" onPress={() => router.push({ pathname: "/(app)/incident/new", params: { dutyId: duty.id } })} />
      </View>
    </AppScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return <View style={styles.metaItem}><Text style={[styles.metaLabel, { color: theme.muted }]}>{label.toUpperCase()}</Text><Text style={[styles.metaValue, { color: theme.ink }]}>{value}</Text></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.ink }]}>{title}</Text>{children}</View>;
}

function PhotoStrip({ title, urls }: { title: string; urls: string[] }) {
  const theme = useAppTheme();
  return <Section title={title}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{urls.map((url, index) => <Image key={`${url}-${index}`} source={{ uri: url }} style={[styles.photo, { backgroundColor: theme.border }]} />)}</ScrollView></Section>;
}

const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 20 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800" },
  badges: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  meta: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 16, gap: 13 },
  metaItem: { gap: 3 },
  metaLabel: { fontSize: 10, fontWeight: "800" },
  metaValue: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  section: { gap: 9, marginTop: 23 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 21 },
  photoRow: { gap: 10 },
  photo: { width: 126, height: 168, borderRadius: 7 },
  evidence: { gap: 18, marginTop: 24 },
  commentList: { gap: 8 },
  comment: { borderWidth: 1, borderRadius: 7, padding: 13, gap: 5 },
  commentAuthor: { fontSize: 13, fontWeight: "700" },
  commentDate: { fontSize: 11 },
  actions: { gap: 10, marginTop: 26 },
  readOnly: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
});
