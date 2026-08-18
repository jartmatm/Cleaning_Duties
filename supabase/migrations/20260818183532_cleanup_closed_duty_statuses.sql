-- Archived, Missed, and Incomplete are terminal duty states. Keep their original
-- status for analytics, then apply the company's shared retention period.
create or replace function public.cleanup_archived_duties_for_company(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_days integer;
  v_export_requires_backup boolean := false;
  v_last_exported_at timestamptz;
  v_deleted_count integer := 0;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not authorized to clean closed duties';
  end if;

  select company.archive_cleanup_enabled, company.archive_cleanup_days
  into v_enabled, v_days
  from public.companies as company
  where company.id = p_company_id;

  if not coalesce(v_enabled, false) then
    return 0;
  end if;

  select
    export.enabled
      and export.connected_at is not null
      and export.format = 'google_sheets',
    export.last_exported_at
  into v_export_requires_backup, v_last_exported_at
  from public.company_data_exports as export
  where export.company_id = p_company_id;

  delete from public.cleaning_duties as duty
  using public.sites as site
  where duty.site_id = site.id
    and site.company_id = p_company_id
    and duty.status::text in ('Archived', 'Missed', 'Incomplete')
    and coalesce(duty.completed_at, duty.updated_at) < now() - make_interval(days => least(greatest(coalesce(v_days, 10), 1), 999))
    and (
      not coalesce(v_export_requires_backup, false)
      or (
        v_last_exported_at is not null
        and v_last_exported_at >= duty.updated_at
      )
    )
    and cardinality(coalesce(duty.reference_photos, '{}'::text[])) = 0
    and cardinality(coalesce(duty.completion_photos, '{}'::text[])) = 0
    and cardinality(coalesce(duty.before_photos, '{}'::text[])) = 0
    and cardinality(coalesce(duty.after_photos, '{}'::text[])) = 0
    and not exists (
      select 1
      from public.duty_photos as photo
      where photo.duty_id = duty.id
    );

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke all on function public.cleanup_archived_duties_for_company(uuid) from public, anon;
grant execute on function public.cleanup_archived_duties_for_company(uuid) to authenticated, service_role;
