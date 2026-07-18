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

  if (!dutyId) return res.status(400).json({ error: "dutyId is required" });
  if (!siteId) return res.status(400).json({ error: "siteId is required" });
  if (!assignedBy) return res.status(400).json({ error: "assignedBy is required" });

  try {
    const supabase = createSupabaseAdminClient();

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

    const recipientIds = Array.from(new Set(assignedUserIds)).filter(Boolean);
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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, company_id")
        .eq("id", profileId)
        .single<ProfileRow>();

      recipientEmails.push({
        id: profileId,
        fullName: profileData?.full_name ?? userData.user.email,
        email: userData.user.email,
      });
    }

    const appUrl = env.APP_URL ?? "https://cleaning-duties.onrender.com";
    const emailResults: Array<{ id: string; status: "sent" | "skipped" }> = [];
    for (const recipient of recipientEmails) {
      const subject = `New duty assigned: ${duty.title}`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 12px;">New cleaning duty assigned</h2>
          <p style="margin: 0 0 8px;">Hi ${recipient.fullName},</p>
          <p style="margin: 0 0 8px;">You have been assigned to <strong>${duty.title}</strong> at <strong>${duty.sites?.name ?? "your site"}</strong>.</p>
          <p style="margin: 0 0 8px;">Priority: <strong>${duty.priority}</strong></p>
          <p style="margin: 0 0 16px;">Assigned by: <strong>${assignerProfile.full_name}</strong></p>
          <p><a href="${appUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;">Open Cleaning Duties</a></p>
        </div>
      `;

      try {
        const result = await sendEmail(recipient.email, subject, html);
        emailResults.push({ id: recipient.id, status: result.skipped ? "skipped" : "sent" });
      } catch (error) {
        emailResults.push({ id: recipient.id, status: "skipped" });
      }
    }

    return res.json({
      ok: true,
      notifications_created: notifications.length,
      emails: emailResults,
      email_enabled: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});
