-- Storage objects must be removed through the Storage API. Keep the legacy RPCs
-- useful for media-free duties while preventing older clients from orphaning files.
create or replace function public.cleanup_archived_duties_for_company(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_days integer;
  v_deleted_count integer := 0;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not authorized to clean archived duties';
  end if;

  select company.archive_cleanup_enabled, company.archive_cleanup_days
  into v_enabled, v_days
  from public.companies as company
  where company.id = p_company_id;

  if not coalesce(v_enabled, false) then
    return 0;
  end if;

  delete from public.cleaning_duties as duty
  using public.sites as site
  where duty.site_id = site.id
    and site.company_id = p_company_id
    and duty.status::text = 'Archived'
    and coalesce(duty.completed_at, duty.updated_at) < now() - make_interval(days => least(greatest(coalesce(v_days, 10), 1), 999))
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
