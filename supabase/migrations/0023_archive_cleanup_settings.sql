alter table public.companies
  add column if not exists archive_cleanup_enabled boolean not null default false,
  add column if not exists archive_cleanup_days integer not null default 10;

alter table public.companies
  drop constraint if exists companies_archive_cleanup_days_range;

alter table public.companies
  add constraint companies_archive_cleanup_days_range
  check (archive_cleanup_days between 1 and 999);

create or replace function public.cleanup_archived_duties_for_company(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_days integer;
  v_deleted_count integer := 0;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not authorized to clean archived duties';
  end if;

  select archive_cleanup_enabled, archive_cleanup_days
  into v_enabled, v_days
  from public.companies
  where id = p_company_id;

  if not coalesce(v_enabled, false) then
    return 0;
  end if;

  delete from public.cleaning_duties duty
  using public.sites site
  where duty.site_id = site.id
    and site.company_id = p_company_id
    and duty.status::text = 'Archived'
    and coalesce(duty.completed_at, duty.updated_at) < now() - make_interval(days => least(greatest(coalesce(v_days, 10), 1), 999));

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

create or replace function public.cleanup_archived_duties_for_site(p_site_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id
  into v_company_id
  from public.sites
  where id = p_site_id;

  if v_company_id is null then
    return 0;
  end if;

  return public.cleanup_archived_duties_for_company(v_company_id);
end;
$$;

create or replace function public.cleanup_archived_duties_for_profile(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id
  into v_company_id
  from public.profiles
  where id = p_profile_id
    and auth.uid() = id;

  if v_company_id is null then
    return 0;
  end if;

  return public.cleanup_archived_duties_for_company(v_company_id);
end;
$$;

revoke all on function public.cleanup_archived_duties_for_company(uuid) from public;
revoke all on function public.cleanup_archived_duties_for_site(uuid) from public;
revoke all on function public.cleanup_archived_duties_for_profile(uuid) from public;
grant execute on function public.cleanup_archived_duties_for_company(uuid) to authenticated;
grant execute on function public.cleanup_archived_duties_for_site(uuid) to authenticated;
grant execute on function public.cleanup_archived_duties_for_profile(uuid) to authenticated;
