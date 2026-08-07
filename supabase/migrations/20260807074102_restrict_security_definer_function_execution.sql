-- Supabase can retain role-specific EXECUTE grants even after revoking PUBLIC.
-- Keep policy helpers and client RPCs available only to authenticated clients.
revoke execute on function public.advance_duty_schedule(uuid) from public, anon;
revoke execute on function public.can_access_duty(uuid) from public, anon;
revoke execute on function public.can_access_profile(uuid) from public, anon;
revoke execute on function public.can_access_site(uuid) from public, anon;
revoke execute on function public.can_assign_cleaner_to_duty(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_site(uuid) from public, anon;
revoke execute on function public.can_submit_unplanned_duty(uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) from public, anon;
revoke execute on function public.cleanup_archived_duties_for_company(uuid) from public, anon;
revoke execute on function public.cleanup_archived_duties_for_profile(uuid) from public, anon;
revoke execute on function public.cleanup_archived_duties_for_site(uuid) from public, anon;
revoke execute on function public.is_company_manager(uuid) from public, anon;
revoke execute on function public.is_company_member(uuid) from public, anon;
revoke execute on function public.is_company_staff(uuid) from public, anon;
revoke execute on function public.is_duty_assignee(uuid) from public, anon;
revoke execute on function public.is_site_member(uuid) from public, anon;
revoke execute on function public.review_unplanned_duty_request(uuid, boolean) from public, anon;

grant execute on function public.advance_duty_schedule(uuid) to authenticated, service_role;
grant execute on function public.can_access_duty(uuid) to authenticated, service_role;
grant execute on function public.can_access_profile(uuid) to authenticated, service_role;
grant execute on function public.can_access_site(uuid) to authenticated, service_role;
grant execute on function public.can_assign_cleaner_to_duty(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_site(uuid) to authenticated, service_role;
grant execute on function public.can_submit_unplanned_duty(uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.cleanup_archived_duties_for_company(uuid) to authenticated, service_role;
grant execute on function public.cleanup_archived_duties_for_profile(uuid) to authenticated, service_role;
grant execute on function public.cleanup_archived_duties_for_site(uuid) to authenticated, service_role;
grant execute on function public.is_company_manager(uuid) to authenticated, service_role;
grant execute on function public.is_company_member(uuid) to authenticated, service_role;
grant execute on function public.is_company_staff(uuid) to authenticated, service_role;
grant execute on function public.is_duty_assignee(uuid) to authenticated, service_role;
grant execute on function public.is_site_member(uuid) to authenticated, service_role;
grant execute on function public.review_unplanned_duty_request(uuid, boolean) to authenticated, service_role;

-- Trigger functions are invoked by PostgreSQL and are not public RPC endpoints.
revoke execute on function public.ensure_site_storage_bucket() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.remove_rejected_unplanned_duty_audit() from public, anon, authenticated;
