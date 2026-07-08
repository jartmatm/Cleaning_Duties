import { supabase } from "./supabase-client";

export type NotificationItem = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(profileId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typedRow = row as NotificationRow;
    return {
      id: typedRow.id,
      type: typedRow.type,
      payload: typedRow.payload,
      readAt: typedRow.read_at,
      createdAt: typedRow.created_at,
    } satisfies NotificationItem;
  });
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);

  if (error) {
    throw new Error(error.message);
  }
}
