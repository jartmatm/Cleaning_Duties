import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type NotificationEvent =
  | "session_started"
  | "duty_assigned"
  | "duty_completed"
  | "incident_reported"
  | "unplanned_duty_submitted";
type UserRole = "Manager" | "Supervisor" | "Cleaner";

type EventPayload = {
  event?: NotificationEvent;
  eventId?: string;
  dutyId?: string;
  assignedUserIds?: string[];
  incidentId?: string;
  requestId?: string;
};

type ProfileRow = {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
};

type DutyRow = {
  id: string;
  site_id: string;
  previous_duty_id: string | null;
  title: string;
  priority: string;
  status: string;
  completed_at: string | null;
  sites: {
    id: string;
    name: string;
    company_id: string;
  } | null;
};

type Recipient = Pick<ProfileRow, "id" | "full_name" | "email">;

type IncidentRow = {
  id: string;
  site_id: string;
  reported_by: string;
  incident_type: string;
  details: string;
  sites: {
    id: string;
    name: string;
    company_id: string;
  } | null;
};

type UnplannedDutyRequestRow = {
  id: string;
  company_id: string;
  site_id: string;
  cleaner_id: string;
  title: string;
  location: string;
  sites: {
    id: string;
    name: string;
    company_id: string;
  } | null;
};

const ONE_SIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "3d22eb0b-ce92-4065-b9dc-bf43c4e5d10d";
const ONE_SIGNAL_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const WEB_APP_URL = (Deno.env.get("APP_URL") ?? "https://cleaning-duties-web.vercel.app").replace(/\/$/, "");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function idempotencyUuid(seed: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = Array.from(hash.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function emailDocument(title: string, greeting: string, copy: string, buttonLabel: string, buttonUrl: string) {
  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f4f6f8;padding:32px 16px;font-family:Arial,sans-serif;color:#111827;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Cleaning Duties</p>
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 12px;line-height:1.6;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 24px;line-height:1.6;color:#475569;">${copy}</p>
          <a href="${buttonUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700;">${escapeHtml(buttonLabel)}</a>
        </div>
      </body>
    </html>
  `;
}

async function sendOneSignal(channel: "push" | "email", body: Record<string, unknown>) {
  if (!ONE_SIGNAL_API_KEY) {
    return { status: "skipped" as const, reason: "ONESIGNAL_REST_API_KEY is not configured" };
  }

  const response = await fetch(`https://api.onesignal.com/notifications?c=${channel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${ONE_SIGNAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_id: ONE_SIGNAL_APP_ID, ...body }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OneSignal ${channel} error (${response.status}): ${responseText}`);
  }

  const result = responseText ? JSON.parse(responseText) as { id?: string } : {};
  return result.id
    ? { status: "sent" as const, messageId: result.id }
    : { status: "skipped" as const, reason: "No eligible subscription" };
}

async function deliverToRecipient(input: {
  recipient: Recipient;
  title: string;
  message: string;
  emailSubject: string;
  emailHtml: string;
  event: NotificationEvent;
  eventId: string;
  dutyId?: string;
  siteId?: string;
  incidentId?: string;
  requestId?: string;
  webPath: string;
  idempotencySeed?: string;
}) {
  const data = {
    event: input.event,
    eventId: input.eventId,
    dutyId: input.dutyId,
    siteId: input.siteId,
    incidentId: input.incidentId,
    requestId: input.requestId,
  };
  const [pushIdempotencyKey, emailIdempotencyKey] = await Promise.all([
    idempotencyUuid(`${input.idempotencySeed ?? input.eventId}:push:${input.recipient.id}`),
    idempotencyUuid(`${input.idempotencySeed ?? input.eventId}:email:${input.recipient.id}`),
  ]);
  const pushPromise = sendOneSignal("push", {
    include_aliases: { external_id: [input.recipient.id] },
    target_channel: "push",
    headings: { en: input.title },
    contents: { en: input.message },
    data,
    web_url: `${WEB_APP_URL}${input.webPath}`,
    ios_badgeType: "Increase",
    ios_badgeCount: 1,
    idempotency_key: pushIdempotencyKey,
  });
  const emailPromise = input.recipient.email
    ? sendOneSignal("email", {
        email_to: [input.recipient.email],
        target_channel: "email",
        email_subject: input.emailSubject,
        email_body: input.emailHtml,
        email_from_name: "Cleaning Duties",
        idempotency_key: emailIdempotencyKey,
      })
    : Promise.resolve({ status: "skipped" as const, reason: "Recipient has no email" });

  const [push, email] = await Promise.allSettled([pushPromise, emailPromise]);
  return {
    profileId: input.recipient.id,
    push: push.status === "fulfilled" ? push.value : { status: "failed", reason: String(push.reason) },
    email: email.status === "fulfilled" ? email.value : { status: "failed", reason: String(email.reason) },
  };
}

async function getSiteStaffRecipients(admin: any, companyId: string, siteId: string, excludedProfileId: string) {
  const [{ data: managers, error: managerError }, { data: memberships, error: membershipError }] = await Promise.all([
    admin.from("profiles").select("id, company_id, full_name, email, role").eq("company_id", companyId).eq("role", "Manager"),
    admin.from("site_members").select("profile_id").eq("site_id", siteId),
  ]);
  if (managerError) throw new Error(managerError.message);
  if (membershipError) throw new Error(membershipError.message);

  const memberIds = (memberships ?? []).map((membership: { profile_id: string }) => membership.profile_id);
  const { data: supervisors, error: supervisorError } = memberIds.length > 0
    ? await admin.from("profiles").select("id, company_id, full_name, email, role").eq("company_id", companyId).eq("role", "Supervisor").in("id", memberIds)
    : { data: [], error: null };
  if (supervisorError) throw new Error(supervisorError.message);

  const recipients = new Map([...(managers ?? []), ...(supervisors ?? [])].map((profile: ProfileRow) => [profile.id, profile]));
  recipients.delete(excludedProfileId);
  return [...recipients.values()] as ProfileRow[];
}

async function existingNotificationRecipients(admin: any, type: string, recipientIds: string[], payloadMatch: Record<string, unknown>) {
  if (recipientIds.length === 0) return new Set<string>();
  const { data, error } = await admin
    .from("notifications")
    .select("profile_id")
    .eq("type", type)
    .in("profile_id", recipientIds)
    .contains("payload", payloadMatch);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((item: { profile_id: string }) => item.profile_id));
}

async function getCaller(admin: any, callerId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, company_id, full_name, email, role")
    .eq("id", callerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}

async function getDuty(admin: any, dutyId: string) {
  const { data, error } = await admin
    .from("cleaning_duties")
    .select("id, site_id, previous_duty_id, title, priority, status, completed_at, sites(id, name, company_id)")
    .eq("id", dutyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DutyRow | null;
}

async function handleSessionStarted(admin: any, caller: ProfileRow, eventId: string) {
  const { data: priorEvents, error: priorEventError } = await admin
    .from("activity_logs")
    .select("id")
    .eq("actor_id", caller.id)
    .eq("action", "login_notification_sent")
    .contains("metadata", { event_id: eventId })
    .limit(1);
  if (priorEventError) throw new Error(priorEventError.message);
  if ((priorEvents ?? []).length > 0) return { duplicate: true, deliveries: [] };

  const occurredAt = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" });
  const title = "New sign-in detected";
  const message = `A new sign-in to your Cleaning Duties account was detected at ${occurredAt}.`;
  const emailHtml = emailDocument(
    title,
    `Hi ${caller.full_name},`,
    `A new sign-in to your Cleaning Duties account was detected at <strong>${escapeHtml(occurredAt)}</strong>. If this was not you, reset your password immediately.`,
    "Open Cleaning Duties",
    `${WEB_APP_URL}/dashboard`,
  );
  const delivery = await deliverToRecipient({
    recipient: caller,
    title,
    message,
    emailSubject: "Security alert: new Cleaning Duties sign-in",
    emailHtml,
    event: "session_started",
    eventId,
    webPath: "/dashboard",
  });

  const { error: logError } = await admin.from("activity_logs").insert({
    company_id: caller.company_id,
    actor_id: caller.id,
    entity_type: "profile",
    entity_id: caller.id,
    action: "login_notification_sent",
    metadata: { event_id: eventId },
  });
  if (logError) throw new Error(logError.message);
  return { duplicate: false, deliveries: [delivery] };
}

async function handleDutyAssigned(admin: any, caller: ProfileRow, eventId: string, dutyId: string, requestedIds: string[]) {
  if (!uuidPattern.test(dutyId)) throw new Error("A valid dutyId is required");

  const duty = await getDuty(admin, dutyId);
  if (!duty?.sites || duty.sites.company_id !== caller.company_id) throw new Error("Duty not found in your company");
  if (caller.role === "Cleaner") {
    if (!duty.previous_duty_id) throw new Error("Cleaners cannot assign duties");
    const { data: callerAssignment, error } = await admin
      .from("duty_assignments")
      .select("id")
      .eq("duty_id", duty.id)
      .eq("profile_id", caller.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!callerAssignment) throw new Error("You are not assigned to this recurring duty");
  }
  if (caller.role === "Supervisor") {
    const { data: access, error } = await admin.from("site_members").select("id").eq("site_id", duty.site_id).eq("profile_id", caller.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!access) throw new Error("This duty is outside your assigned sites");
  }

  const uniqueRequestedIds = [...new Set(requestedIds)].filter((id) => uuidPattern.test(id)).slice(0, 100);
  if (uniqueRequestedIds.length === 0) return { duplicate: false, deliveries: [] };

  const [{ data: assignments, error: assignmentError }, { data: profiles, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
    admin.from("duty_assignments").select("id, profile_id").eq("duty_id", duty.id).in("profile_id", uniqueRequestedIds),
    admin.from("profiles").select("id, company_id, full_name, email, role").eq("company_id", caller.company_id).eq("role", "Cleaner").in("id", uniqueRequestedIds),
    admin.from("site_members").select("profile_id").eq("site_id", duty.site_id).in("profile_id", uniqueRequestedIds),
  ]);
  if (assignmentError) throw new Error(assignmentError.message);
  if (profileError) throw new Error(profileError.message);
  if (membershipError) throw new Error(membershipError.message);

  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const memberIds = new Set((memberships ?? []).map((membership: { profile_id: string }) => membership.profile_id));
  const assignmentByProfileId = new Map((assignments ?? []).map((assignment: { id: string; profile_id: string }) => [assignment.profile_id, assignment.id]));
  const assignmentIds = [...assignmentByProfileId.values()];
  const { data: existing, error: existingError } = assignmentIds.length > 0
    ? await admin.from("notifications").select("payload").eq("type", "duty_assigned").in("profile_id", uniqueRequestedIds)
    : { data: [], error: null };
  if (existingError) throw new Error(existingError.message);
  const notifiedAssignmentIds = new Set((existing ?? []).map((item: { payload: Record<string, unknown> }) => item.payload?.assignmentId).filter(Boolean));

  const validAssignments = uniqueRequestedIds
    .map((profileId) => ({ profile: profileById.get(profileId), assignmentId: assignmentByProfileId.get(profileId) }))
    .filter((item): item is { profile: ProfileRow; assignmentId: string } => Boolean(item.profile && item.assignmentId && memberIds.has(item.profile.id)));
  const newNotifications = validAssignments.filter(({ assignmentId }) => !notifiedAssignmentIds.has(assignmentId));
  if (validAssignments.length === 0) return { duplicate: false, deliveries: [] };

  if (newNotifications.length > 0) {
    const { error: notificationError } = await admin.from("notifications").insert(newNotifications.map(({ profile, assignmentId }) => ({
      profile_id: profile.id,
      type: "duty_assigned",
      payload: {
        eventId,
        assignmentId,
        dutyId: duty.id,
        siteId: duty.site_id,
        assignedBy: caller.id,
        title: duty.title,
        priority: duty.priority,
      },
    })));
    if (notificationError) throw new Error(notificationError.message);
  }

  const deliveries = await Promise.all(validAssignments.map(({ profile, assignmentId }) => {
    const title = "New cleaning duty assigned";
    const message = `${duty.title} at ${duty.sites?.name ?? "your site"}`;
    return deliverToRecipient({
      recipient: profile,
      title,
      message,
      emailSubject: `New duty assigned: ${duty.title}`,
      emailHtml: emailDocument(
        title,
        `Hi ${profile.full_name},`,
        `You have been assigned to <strong>${escapeHtml(duty.title)}</strong> at <strong>${escapeHtml(duty.sites?.name ?? "your site")}</strong>. Priority: <strong>${escapeHtml(duty.priority)}</strong>.`,
        "View duty",
        `${WEB_APP_URL}/duties`,
      ),
      event: "duty_assigned",
      eventId,
      dutyId: duty.id,
      siteId: duty.site_id,
      webPath: "/duties",
      idempotencySeed: assignmentId,
    });
  }));
  return { duplicate: newNotifications.length === 0, deliveries };
}

async function handleDutyCompleted(admin: any, caller: ProfileRow, eventId: string, dutyId: string) {
  if (!uuidPattern.test(dutyId)) throw new Error("A valid dutyId is required");
  const duty = await getDuty(admin, dutyId);
  if (!duty?.sites || duty.sites.company_id !== caller.company_id) throw new Error("Duty not found in your company");
  if (duty.status !== "Completed") throw new Error("The duty has not been completed");

  const { data: assignment, error: assignmentError } = await admin
    .from("duty_assignments")
    .select("id")
    .eq("duty_id", duty.id)
    .eq("profile_id", caller.id)
    .maybeSingle();
  if (assignmentError) throw new Error(assignmentError.message);
  if (caller.role === "Cleaner" && !assignment) throw new Error("You are not assigned to this duty");

  const staffRecipients = await getSiteStaffRecipients(admin, caller.company_id, duty.site_id, caller.id);
  const recipientIds = staffRecipients.map((profile) => profile.id);
  if (recipientIds.length === 0) return { duplicate: false, deliveries: [] };

  const alreadyNotified = await existingNotificationRecipients(admin, "duty_completed", recipientIds, { dutyId: duty.id });
  const newNotificationRecipients = staffRecipients.filter((profile) => !alreadyNotified.has(profile.id));

  const completedAt = duty.completed_at ?? new Date().toISOString();
  if (newNotificationRecipients.length > 0) {
    const { error: notificationError } = await admin.from("notifications").insert(newNotificationRecipients.map((profile) => ({
      profile_id: profile.id,
      type: "duty_completed",
      payload: {
        eventId,
        dutyId: duty.id,
        siteId: duty.site_id,
        cleanerId: caller.id,
        cleanerName: caller.full_name,
        title: duty.title,
        completedAt,
      },
    })));
    if (notificationError) throw new Error(notificationError.message);
  }

  const deliveries = await Promise.all(staffRecipients.map((profile) => {
    const title = "Cleaning duty completed";
    const message = `${caller.full_name} completed ${duty.title} at ${duty.sites?.name ?? "the site"}.`;
    return deliverToRecipient({
      recipient: profile,
      title,
      message,
      emailSubject: `Duty completed: ${duty.title}`,
      emailHtml: emailDocument(
        title,
        `Hi ${profile.full_name},`,
        `<strong>${escapeHtml(caller.full_name)}</strong> completed <strong>${escapeHtml(duty.title)}</strong> at <strong>${escapeHtml(duty.sites?.name ?? "the site")}</strong>.`,
        "Review duty",
        `${WEB_APP_URL}/duties`,
      ),
      event: "duty_completed",
      eventId,
      dutyId: duty.id,
      siteId: duty.site_id,
      webPath: "/duties",
      idempotencySeed: `${duty.id}:${completedAt}`,
    });
  }));
  return { duplicate: newNotificationRecipients.length === 0, deliveries };
}

async function handleIncidentReported(admin: any, caller: ProfileRow, eventId: string, incidentId: string) {
  if (!uuidPattern.test(incidentId)) throw new Error("A valid incidentId is required");
  const { data, error } = await admin
    .from("incidents")
    .select("id, site_id, reported_by, incident_type, details, sites(id, name, company_id)")
    .eq("id", incidentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const incident = data as IncidentRow | null;
  if (!incident?.sites || incident.sites.company_id !== caller.company_id || incident.reported_by !== caller.id) {
    throw new Error("Incident not found for this reporter");
  }

  const staffRecipients = await getSiteStaffRecipients(admin, caller.company_id, incident.site_id, caller.id);
  const recipientIds = staffRecipients.map((profile) => profile.id);
  const alreadyNotified = await existingNotificationRecipients(admin, "incident_reported", recipientIds, { incidentId: incident.id });
  const newNotificationRecipients = staffRecipients.filter((profile) => !alreadyNotified.has(profile.id));
  if (staffRecipients.length === 0) return { duplicate: false, deliveries: [] };

  if (newNotificationRecipients.length > 0) {
    const { error: notificationError } = await admin.from("notifications").insert(newNotificationRecipients.map((profile) => ({
      profile_id: profile.id,
      type: "incident_reported",
      payload: {
        eventId,
        incidentId: incident.id,
        siteId: incident.site_id,
        reporterId: caller.id,
        reporterName: caller.full_name,
        title: `${incident.incident_type} incident`,
      },
    })));
    if (notificationError) throw new Error(notificationError.message);
  }

  const deliveries = await Promise.all(staffRecipients.map((profile) => deliverToRecipient({
    recipient: profile,
    title: "New incident reported",
    message: `${caller.full_name} reported a ${incident.incident_type.toLowerCase()} incident at ${incident.sites?.name ?? "the site"}.`,
    emailSubject: `Incident reported: ${incident.incident_type}`,
    emailHtml: emailDocument(
      "New incident reported",
      `Hi ${profile.full_name},`,
      `<strong>${escapeHtml(caller.full_name)}</strong> reported a <strong>${escapeHtml(incident.incident_type)}</strong> incident at <strong>${escapeHtml(incident.sites?.name ?? "the site")}</strong>.`,
      "Review incident",
      `${WEB_APP_URL}/dashboard`,
    ),
    event: "incident_reported",
    eventId,
    incidentId: incident.id,
    siteId: incident.site_id,
    webPath: "/dashboard",
    idempotencySeed: incident.id,
  })));
  return { duplicate: newNotificationRecipients.length === 0, deliveries };
}

async function handleUnplannedDutySubmitted(admin: any, caller: ProfileRow, eventId: string, requestId: string) {
  if (!uuidPattern.test(requestId)) throw new Error("A valid requestId is required");
  const { data, error } = await admin
    .from("unplanned_duty_requests")
    .select("id, company_id, site_id, cleaner_id, title, location, sites(id, name, company_id)")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const unplannedRequest = data as UnplannedDutyRequestRow | null;
  if (!unplannedRequest?.sites || unplannedRequest.company_id !== caller.company_id || unplannedRequest.cleaner_id !== caller.id) {
    throw new Error("Unplanned duty request not found for this cleaner");
  }

  const staffRecipients = await getSiteStaffRecipients(admin, caller.company_id, unplannedRequest.site_id, caller.id);
  const recipientIds = staffRecipients.map((profile) => profile.id);
  const alreadyNotified = await existingNotificationRecipients(admin, "unplanned_duty_submitted", recipientIds, { requestId: unplannedRequest.id });
  const newNotificationRecipients = staffRecipients.filter((profile) => !alreadyNotified.has(profile.id));
  if (staffRecipients.length === 0) return { duplicate: false, deliveries: [] };

  if (newNotificationRecipients.length > 0) {
    const { error: notificationError } = await admin.from("notifications").insert(newNotificationRecipients.map((profile) => ({
      profile_id: profile.id,
      type: "unplanned_duty_submitted",
      payload: {
        eventId,
        requestId: unplannedRequest.id,
        siteId: unplannedRequest.site_id,
        cleanerId: caller.id,
        cleanerName: caller.full_name,
        title: unplannedRequest.title,
      },
    })));
    if (notificationError) throw new Error(notificationError.message);
  }

  const deliveries = await Promise.all(staffRecipients.map((profile) => deliverToRecipient({
    recipient: profile,
    title: "Unplanned duty awaiting review",
    message: `${caller.full_name} submitted ${unplannedRequest.title} at ${unplannedRequest.sites?.name ?? "the site"}.`,
    emailSubject: `Unplanned duty submitted: ${unplannedRequest.title}`,
    emailHtml: emailDocument(
      "Unplanned duty awaiting review",
      `Hi ${profile.full_name},`,
      `<strong>${escapeHtml(caller.full_name)}</strong> submitted <strong>${escapeHtml(unplannedRequest.title)}</strong> at <strong>${escapeHtml(unplannedRequest.sites?.name ?? "the site")}</strong>, location: <strong>${escapeHtml(unplannedRequest.location)}</strong>.`,
      "Review request",
      `${WEB_APP_URL}/dashboard`,
    ),
    event: "unplanned_duty_submitted",
    eventId,
    requestId: unplannedRequest.id,
    siteId: unplannedRequest.site_id,
    webPath: "/dashboard",
    idempotencySeed: unplannedRequest.id,
  })));
  return { duplicate: newNotificationRecipients.length === 0, deliveries };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    if (!ONE_SIGNAL_API_KEY) {
      return Response.json({ error: "Notification delivery is not configured" }, { status: 503 });
    }

    const payload = await request.json() as EventPayload;
    const callerId = context.userClaims?.id;
    const eventId = payload.eventId && uuidPattern.test(payload.eventId) ? payload.eventId : crypto.randomUUID();
    if (!callerId) return Response.json({ error: "Authentication required" }, { status: 401 });

    const caller = await getCaller(context.supabaseAdmin, callerId);
    if (!caller) return Response.json({ error: "Profile not found" }, { status: 404 });

    try {
      if (payload.event === "session_started") {
        return Response.json({ ok: true, eventId, ...(await handleSessionStarted(context.supabaseAdmin, caller, eventId)) });
      }
      if (payload.event === "duty_assigned") {
        return Response.json({ ok: true, eventId, ...(await handleDutyAssigned(context.supabaseAdmin, caller, eventId, payload.dutyId ?? "", payload.assignedUserIds ?? [])) });
      }
      if (payload.event === "duty_completed") {
        return Response.json({ ok: true, eventId, ...(await handleDutyCompleted(context.supabaseAdmin, caller, eventId, payload.dutyId ?? "")) });
      }
      if (payload.event === "incident_reported") {
        return Response.json({ ok: true, eventId, ...(await handleIncidentReported(context.supabaseAdmin, caller, eventId, payload.incidentId ?? "")) });
      }
      if (payload.event === "unplanned_duty_submitted") {
        return Response.json({ ok: true, eventId, ...(await handleUnplannedDutySubmitted(context.supabaseAdmin, caller, eventId, payload.requestId ?? "")) });
      }
      return Response.json({ error: "Unsupported notification event" }, { status: 400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notification event failed";
      console.error("notification-events", { event: payload.event, eventId, callerId, message });
      return Response.json({ error: message, eventId }, { status: 400 });
    }
  }),
};
