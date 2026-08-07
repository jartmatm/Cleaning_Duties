-- RLS limits rows, but privileges such as TRUNCATE are not row-scoped.
-- Anonymous users do not access business tables; Auth handles signup and login.
revoke all privileges on table
  public.activity_logs,
  public.cleaning_duties,
  public.companies,
  public.duty_assignments,
  public.duty_comments,
  public.duty_photos,
  public.incidents,
  public.notifications,
  public.preloaded_duties,
  public.profiles,
  public.service_reports,
  public.site_members,
  public.sites,
  public.unplanned_duty_requests
from anon;

-- These privileges are not used by the app and are not protected by row policies.
revoke truncate, trigger, references on table
  public.activity_logs,
  public.cleaning_duties,
  public.companies,
  public.duty_assignments,
  public.duty_comments,
  public.duty_photos,
  public.incidents,
  public.notifications,
  public.preloaded_duties,
  public.profiles,
  public.service_reports,
  public.site_members,
  public.sites,
  public.unplanned_duty_requests
from authenticated;

-- Remove row operations for which no authenticated policy or client flow exists.
revoke insert, update, delete on table public.activity_logs from authenticated;
revoke insert, delete on table public.companies from authenticated;
revoke update on table public.duty_assignments from authenticated;
revoke update, delete on table public.duty_comments from authenticated;
revoke update, delete on table public.duty_photos from authenticated;
revoke update, delete on table public.incidents from authenticated;
revoke insert, delete on table public.notifications from authenticated;
revoke insert, delete on table public.profiles from authenticated;
revoke update on table public.service_reports from authenticated;
revoke update, delete on table public.unplanned_duty_requests from authenticated;

-- Profile edits remain intentionally limited to self-service fields.
revoke update on table public.profiles from authenticated;
grant update (full_name, email, phone, updated_at) on table public.profiles to authenticated;
