import { supabase } from "./supabase-client";

export type NotificationEventPayload =
  | { event: "session_started"; eventId?: string }
  | { event: "duty_assigned"; dutyId: string; assignedUserIds: string[]; eventId?: string }
  | { event: "duty_completed"; dutyId: string; eventId?: string }
  | { event: "incident_reported"; incidentId: string; eventId?: string }
  | { event: "unplanned_duty_submitted"; requestId: string; eventId?: string };

async function functionErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error && (error as { context?: unknown }).context instanceof Response) {
    const response = (error as { context: Response }).context;
    try {
      const body = await response.clone().json() as { error?: unknown; message?: unknown };
      const message = body.error ?? body.message;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      const message = await response.clone().text();
      if (message.trim()) return message;
    }
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : "The notification event could not be delivered.";
}

export async function emitNotificationEvent(payload: NotificationEventPayload) {
  const { data, error } = await supabase.functions.invoke("notification-events", {
    body: {
      ...payload,
      eventId: payload.eventId ?? crypto.randomUUID(),
    },
  });

  if (error) throw new Error(await functionErrorMessage(error));
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
