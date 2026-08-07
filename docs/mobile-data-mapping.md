# Mobile Data Mapping

The mobile app uses the existing production model. It does not introduce alternate task, user, location, assignment, or image tables.

| Mobile surface | Existing web equivalent | Supabase table or RPC | Role and scope | Mobile mutations |
| --- | --- | --- | --- | --- |
| Sign in and restore | `auth-service.ts`, `supabase-client.ts` | Supabase Auth | Any authenticated account | Sign in, sign out, reset password |
| Session bootstrap | `profile-service.ts`, `company-service.ts`, `sites-service.ts` | `profiles`, `companies`, `site_members`, `sites` | Own profile; company and sites according to RLS | Update password; profile mutation is prepared in the service layer |
| Home | `DashboardPage.tsx`, `duties-service.ts` | `cleaning_duties`, `duty_assignments`, `cleanup_archived_duties_for_site`, `cleanup_archived_duties_for_profile`, `advance_duty_schedule` | Cleaner receives assigned duties; staff receives duties for accessible sites | Schedule advancement only through the existing RPC |
| Duties tab | `DutiesPage.tsx`, `duties-service.ts` | `cleaning_duties`, `duty_assignments` | Cleaner by assignment; Supervisor by assigned sites; Manager by company sites | None from the list |
| Duty details | `cleaner-duty-detail-modal.tsx`, `duties-service.ts`, `assignments-service.ts` | `cleaning_duties`, `duty_assignments`, `duty_comments`, `incidents` | Duty access determined by `can_access_duty` and assignment/site RLS | Cleaner: Pending to In Progress, In Progress to Completed; accessible users: add comment |
| Duty evidence | `duty-photo-service.ts`, `image-optimization-service.ts` | Existing site Storage bucket; `cleaning_duties.before_photos`, `cleaning_duties.after_photos` | Accessible duty and site bucket policy | Upload optimized before/after photos and save public URLs |
| Incident form | `incidents-service.ts` | `incidents` | Reporter must have site access; `reported_by` is the authenticated profile | Insert incident with a shared `INCIDENT_TYPES` value |
| Reports: incidents | `ReportsPage.tsx`, `incidents-service.ts` | `incidents` | Cleaner sees own reports; staff sees accessible site reports | Create incident |
| Reports: service reports | `reports-service.ts` | `service_reports` | Manager by company; Supervisor by assigned site; Cleaner hidden | Read only in the mobile MVP |
| Reports: unplanned work | `unplanned-duty-service.ts`, `UnplannedDutyReviewModal.tsx` | `unplanned_duty_requests`, `review_unplanned_duty_request` | Cleaner sees own requests; Manager/Supervisor sees manageable-site requests | Staff approves or rejects through the existing RPC |
| Unplanned-duty wizard | `UnplannedDutyFlow.tsx`, `unplanned-duty-service.ts` | `unplanned_duty_requests`, existing site Storage bucket | Cleaner only, own site, and an active assigned shift | Upload optional before/after evidence and insert request |
| Notifications | `notifications-service.ts`, `duty-notifications.ts` | `notifications` | Own `profile_id` only | Set `read_at`; duty payload deep-link |
| Profile | `profile-service.ts`, `company-service.ts`, `sites-service.ts` | `profiles`, `companies`, `site_members`, `sites` | Own account and accessible sites | Sign out and local active-site selection |

## Shift Semantics

The Home progress view first filters by active site, then selects one exact shift using the persisted `starts_at` and `due_date` pair. During a shift it counts only Pending, In Progress, and Completed duties with that exact pair. Outside a shift it selects the earliest future Scheduled pair. Duties from another date or recurrence are excluded even if their clock time matches.

Site display hours come from `sites.shift_start_time` and `sites.shift_end_time`. Shift instances and midnight crossings are governed by the persisted timestamp pair and the existing `advance_duty_schedule` function.

## Security Boundary

- Every direct query carries the current Supabase user session.
- No mobile module contains a service-role key or privileged provider secret.
- Active-site state is validated against the latest accessible site list before restoration.
- Cleaner status transitions are restricted in the service layer and are still subject to RLS.
- Privileged account creation, billing, Stripe, and notification delivery stay in the Express API.
- Sign out removes Supabase channels and cached user data.
