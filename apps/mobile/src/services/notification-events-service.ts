import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";

export type NotificationEventPayload =
  | { event: "session_started"; eventId?: string }
  | { event: "duty_assigned"; dutyId: string; assignedUserIds: string[]; eventId?: string }
  | { event: "duty_completed"; dutyId: string; eventId?: string }
  | { event: "incident_reported"; incidentId: string; eventId?: string }
  | { event: "unplanned_duty_submitted"; requestId: string; eventId?: string };

export async function emitNotificationEvent(payload: NotificationEventPayload) {
  const { data, error } = await supabase.functions.invoke("notification-events", {
    body: {
      ...payload,
      eventId: payload.eventId ?? randomUUID(),
    },
  });

  if (error) throw new Error(error.message);
  return data as { ok: true; duplicate: boolean };
}

export async function emitNotificationEventSafely(payload: NotificationEventPayload) {
  try {
    return await emitNotificationEvent(payload);
  } catch (error) {
    console.warn("Notification event failed", payload.event, error);
    return null;
  }
}
