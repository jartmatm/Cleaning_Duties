import { Router } from "express";
import { createSupabaseAdminClient } from "../lib/supabase-admin";
import { env } from "../lib/env";

type NotifyAssignmentsBody = {
  dutyId?: string;
  siteId?: string;
  assignedUserIds?: string[];
  assignedBy?: string;
};

type DutyRow = {
  id: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  site_id: string;
  sites: {
    id: string;
    name: string;
    company_id: string;
    companies: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  company_id: string;
};

export const dutyNotificationsRouter = Router();

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendOneSignalNotification(path: "push" | "email", body: Record<string, unknown>) {
  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
    return { skipped: true };
  }

  const response = await fetch(`https://api.onesignal.com/notifications?c=${path}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${env.ONESIGNAL_REST_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: env.ONESIGNAL_APP_ID,
      ...body,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OneSignal ${path} error: ${text}`);
  }

  const result = await response.json();
  return { skipped: false, result };
}

async function sendPush(profileId: string, title: string, message: string, url: string) {
  return sendOneSignalNotification("push", {
    headings: { en: title },
    contents: { en: message },
    include_aliases: { external_id: [profileId] },
    target_channel: "push",
    url,
  });
}

async function sendOneSignalEmail(to: string, subject: string, html: string) {
  return sendOneSignalNotification("email", {
    email_subject: subject,
    email_body: html,
    email_to: [to],
    target_channel: "email",
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email provider error: ${text}`);
  }

  return { skipped: false };
}

dutyNotificationsRouter.post("/assignments", async (req, res) => {
  const { dutyId, siteId, assignedUserIds = [], assignedBy } = req.body as NotifyAssignmentsBody;
  const authorization = req.headers.authorization;

  if (!dutyId) return res.status(400).json({ error: "dutyId is required" });
  if (!siteId) return res.status(400).json({ error: "siteId is required" });
  if (!assignedBy) return res.status(400).json({ error: "assignedBy is required" });
  if (!authorization?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });

  try {
    const supabase = createSupabaseAdminClient();
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user || authData.user.id !== assignedBy) {
      return res.status(401).json({ error: "Your session is no longer valid" });
    }

    const { data: duty, error: dutyError } = await supabase
      .from("cleaning_duties")
      .select("id, title, description, priority, due_date, site_id, sites(id, name, company_id, companies(id, name))")
      .eq("id", dutyId)
      .single<DutyRow>();

    if (dutyError || !duty) {
      return res.status(404).json({ error: dutyError?.message ?? "Duty not found" });
    }

    const { data: assignerProfile, error: assignerError } = await supabase
      .from("profiles")
      .select("id, full_name, company_id")
      .eq("id", assignedBy)
      .single<ProfileRow>();

    if (assignerError || !assignerProfile) {
      return res.status(404).json({ error: assignerError?.message ?? "Assigner not found" });
    }
    if (assignerProfile.company_id !== duty.sites?.company_id) {
      return res.status(403).json({ error: "You are not allowed to notify assignments for this duty" });
    }

    const requestedRecipientIds = Array.from(new Set(assignedUserIds)).filter(Boolean);
    const { data: recipientProfiles, error: recipientProfilesError } = await supabase
      .from("profiles")
      .select("id, full_name, company_id")
      .eq("company_id", duty.sites.company_id)
      .in("id", requestedRecipientIds)
      .returns<ProfileRow[]>();

    if (recipientProfilesError) {
      return res.status(500).json({ error: recipientProfilesError.message });
    }

    const recipientProfilesById = new Map((recipientProfiles ?? []).map((profile) => [profile.id, profile]));
    const recipientIds = requestedRecipientIds.filter((profileId) => recipientProfilesById.has(profileId));
    const notifications = recipientIds.map((profileId) => ({
      profile_id: profileId,
      type: "duty_assigned",
      payload: {
        dutyId,
        siteId,
        assignedBy,
        title: duty.title,
        priority: duty.priority,
      },
    }));

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase.from("notifications").insert(notifications);
      if (notificationError) {
        return res.status(500).json({ error: notificationError.message });
      }
    }

    const recipientEmails: Array<{ id: string; fullName: string; email: string }> = [];
    for (const profileId of recipientIds) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profileId);
      if (userError || !userData.user?.email) {
        continue;
      }

      const profileData = recipientProfilesById.get(profileId);

      recipientEmails.push({
        id: profileId,
        fullName: profileData?.full_name ?? userData.user.email,
        email: userData.user.email,
      });
    }

    const appUrl = env.APP_URL ?? "https://cleaning-duties-web.vercel.app";
    const emailResults: Array<{ id: string; status: "sent" | "skipped" }> = [];
    const pushResults: Array<{ id: string; status: "sent" | "skipped" }> = [];
    for (const recipient of recipientEmails) {
      const subject = `New duty assigned: ${duty.title}`;
      const title = "New cleaning duty assigned";
      const message = `${duty.title} at ${duty.sites?.name ?? "your site"}`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 12px;">${escapeHtml(title)}</h2>
          <p style="margin: 0 0 8px;">Hi ${escapeHtml(recipient.fullName)},</p>
          <p style="margin: 0 0 8px;">You have been assigned to <strong>${escapeHtml(duty.title)}</strong> at <strong>${escapeHtml(duty.sites?.name ?? "your site")}</strong>.</p>
          <p style="margin: 0 0 8px;">Priority: <strong>${escapeHtml(duty.priority)}</strong></p>
          <p style="margin: 0 0 16px;">Assigned by: <strong>${escapeHtml(assignerProfile.full_name)}</strong></p>
          <p><a href="${appUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;">Open Cleaning Duties</a></p>
        </div>
      `;

      try {
        const result = await sendPush(recipient.id, title, message, appUrl);
        pushResults.push({ id: recipient.id, status: result.skipped ? "skipped" : "sent" });
      } catch {
        pushResults.push({ id: recipient.id, status: "skipped" });
      }

      try {
        const result = env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY
          ? await sendOneSignalEmail(recipient.email, subject, html)
          : await sendEmail(recipient.email, subject, html);
        emailResults.push({ id: recipient.id, status: result.skipped ? "skipped" : "sent" });
      } catch (error) {
        emailResults.push({ id: recipient.id, status: "skipped" });
      }
    }

    return res.json({
      ok: true,
      notifications_created: notifications.length,
      pushes: pushResults,
      emails: emailResults,
      onesignal_enabled: Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY),
      email_enabled: Boolean(env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY) || Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});
