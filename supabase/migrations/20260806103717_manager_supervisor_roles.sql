create temporary table preserved_company_managers on commit drop as
select distinct on (p.company_id) p.id
from public.profiles p
where p.role::text = 'Manager'
  and not exists (
    select 1
    from public.profiles owner_profile
    where owner_profile.company_id = p.company_id
      and owner_profile.role::text = 'Owner'
  )
order by p.company_id, p.created_at, p.id;

alter type public.user_role rename value 'Manager' to 'Supervisor';
alter type public.user_role rename value 'Owner' to 'Manager';

update public.profiles
set role = 'Manager'
where id in (select id from preserved_company_managers);

with ranked_managers as (
  select id, row_number() over (partition by company_id order by created_at, id) as manager_position
  from public.profiles
  where role = 'Manager'
)
update public.profiles profile
set role = 'Supervisor'
from ranked_managers ranked
where ranked.id = profile.id
  and ranked.manager_position > 1;

update public.site_members sm
set role = p.role
from public.profiles p
where p.id = sm.profile_id
  and sm.role is distinct from p.role;

update auth.users auth_user
set raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', profile.role::text,
      'company_id', profile.company_id::text,
      'site_ids', coalesce((
        select jsonb_agg(site_member.site_id order by site_member.site_id)
        from public.site_members site_member
        where site_member.profile_id = profile.id
      ), '[]'::jsonb)
    ),
    raw_app_meta_data = coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', profile.role::text,
      'company_id', profile.company_id::text,
      'site_ids', coalesce((
        select jsonb_agg(site_member.site_id order by site_member.site_id)
        from public.site_members site_member
        where site_member.profile_id = profile.id
      ), '[]'::jsonb)
    )
from public.profiles profile
where profile.id = auth_user.id;

create unique index if not exists profiles_one_manager_per_company_idx
on public.profiles (company_id)
where role = 'Manager';

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.company_id = target_company_id
  );
$$;

create or replace function public.is_company_manager(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.company_id = target_company_id
      and profile.role = 'Manager'
  );
$$;

create or replace function public.is_company_staff(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.company_id = target_company_id
      and profile.role in ('Manager', 'Supervisor')
  );
$$;

create or replace function public.is_site_member(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_members site_member
    where site_member.site_id = target_site_id
      and site_member.profile_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites site
    join public.profiles actor on actor.id = (select auth.uid())
    where site.id = target_site_id
      and actor.company_id = site.company_id
      and (
        actor.role = 'Manager'
        or exists (
          select 1
          from public.site_members site_member
          where site_member.site_id = site.id
            and site_member.profile_id = actor.id
        )
      )
  );
$$;

create or replace function public.can_manage_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites site
    join public.profiles actor on actor.id = (select auth.uid())
    where site.id = target_site_id
      and actor.company_id = site.company_id
      and (
        actor.role = 'Manager'
        or (
          actor.role = 'Supervisor'
          and exists (
            select 1
            from public.site_members site_member
            where site_member.site_id = site.id
              and site_member.profile_id = actor.id
          )
        )
      )
  );
$$;

create or replace function public.can_access_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles actor
    join public.profiles target on target.id = target_profile_id
    where actor.id = (select auth.uid())
      and actor.company_id = target.company_id
      and (
        actor.role = 'Manager'
        or actor.id = target.id
        or exists (
          select 1
          from public.site_members actor_site
          join public.site_members target_site on target_site.site_id = actor_site.site_id
          where actor_site.profile_id = actor.id
            and target_site.profile_id = target.id
        )
      )
  );
$$;

create or replace function public.is_duty_assignee(target_duty_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.duty_assignments assignment
    where assignment.duty_id = target_duty_id
      and assignment.profile_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_duty(target_duty_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cleaning_duties duty
    join public.sites site on site.id = duty.site_id
    join public.profiles actor on actor.id = (select auth.uid())
    where duty.id = target_duty_id
      and actor.company_id = site.company_id
      and (
        actor.role = 'Manager'
        or (
          actor.role = 'Supervisor'
          and exists (
            select 1
            from public.site_members supervisor_site
            where supervisor_site.site_id = site.id
              and supervisor_site.profile_id = actor.id
          )
        )
        or exists (
          select 1
          from public.duty_assignments assignment
          where assignment.duty_id = duty.id
            and assignment.profile_id = actor.id
        )
      )
  );
$$;

create or replace function public.can_assign_cleaner_to_duty(target_duty_id uuid, target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cleaning_duties duty
    join public.profiles cleaner
      on cleaner.id = target_profile_id
     and cleaner.role = 'Cleaner'
    join public.sites site on site.id = duty.site_id
    where duty.id = target_duty_id
      and cleaner.company_id = site.company_id
      and exists (
        select 1
        from public.site_members cleaner_site
        where cleaner_site.site_id = duty.site_id
          and cleaner_site.profile_id = cleaner.id
      )
      and public.can_manage_site(duty.site_id)
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_company_manager(uuid) from public;
revoke all on function public.is_company_staff(uuid) from public;
revoke all on function public.is_site_member(uuid) from public;
revoke all on function public.can_access_site(uuid) from public;
revoke all on function public.can_manage_site(uuid) from public;
revoke all on function public.can_access_profile(uuid) from public;
revoke all on function public.is_duty_assignee(uuid) from public;
revoke all on function public.can_access_duty(uuid) from public;
revoke all on function public.can_assign_cleaner_to_duty(uuid, uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated, service_role;
grant execute on function public.is_company_manager(uuid) to authenticated, service_role;
grant execute on function public.is_company_staff(uuid) to authenticated, service_role;
grant execute on function public.is_site_member(uuid) to authenticated, service_role;
grant execute on function public.can_access_site(uuid) to authenticated, service_role;
grant execute on function public.can_manage_site(uuid) to authenticated, service_role;
grant execute on function public.can_access_profile(uuid) to authenticated, service_role;
grant execute on function public.is_duty_assignee(uuid) to authenticated, service_role;
grant execute on function public.can_access_duty(uuid) to authenticated, service_role;
grant execute on function public.can_assign_cleaner_to_duty(uuid, uuid) to authenticated, service_role;

drop policy if exists "profiles can read own row" on public.profiles;
drop policy if exists "profiles company members can read profiles" on public.profiles;
drop policy if exists "profiles accessible by role" on public.profiles;
create policy "profiles accessible by role"
on public.profiles
for select
to authenticated
using ((select public.can_access_profile(id)));

drop policy if exists "profiles can update own row" on public.profiles;
create policy "profiles can update own row"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (full_name, email, phone, updated_at) on public.profiles to authenticated;

drop policy if exists "companies visible to members" on public.companies;
create policy "companies visible to members"
on public.companies
for select
to authenticated
using ((select public.is_company_member(id)));

drop policy if exists "companies editable by owners" on public.companies;
drop policy if exists "companies editable by managers" on public.companies;
create policy "companies editable by managers"
on public.companies
for update
to authenticated
using ((select public.is_company_manager(id)))
with check ((select public.is_company_manager(id)));

drop policy if exists "sites visible to company members" on public.sites;
drop policy if exists "sites visible by role" on public.sites;
create policy "sites visible by role"
on public.sites
for select
to authenticated
using ((select public.can_access_site(id)));

drop policy if exists "sites editable by managers" on public.sites;
create policy "sites insertable by managers"
on public.sites
for insert
to authenticated
with check ((select public.is_company_manager(company_id)));

drop policy if exists "sites updatable by managers" on public.sites;
create policy "sites updatable by managers"
on public.sites
for update
to authenticated
using ((select public.is_company_manager(company_id)))
with check ((select public.is_company_manager(company_id)));

drop policy if exists "sites deletable by managers" on public.sites;
create policy "sites deletable by managers"
on public.sites
for delete
to authenticated
using ((select public.is_company_manager(company_id)));

drop policy if exists "site members visible to company members" on public.site_members;
drop policy if exists "site members visible by site access" on public.site_members;
create policy "site members visible by site access"
on public.site_members
for select
to authenticated
using ((select public.can_access_site(site_id)));

drop policy if exists "site members editable by managers" on public.site_members;
create policy "site members insertable by managers"
on public.site_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.sites site
    where site.id = site_members.site_id
      and (select public.is_company_manager(site.company_id))
  )
);

drop policy if exists "site members updatable by managers" on public.site_members;
create policy "site members updatable by managers"
on public.site_members
for update
to authenticated
using (
  exists (
    select 1
    from public.sites site
    where site.id = site_members.site_id
      and (select public.is_company_manager(site.company_id))
  )
)
with check (
  exists (
    select 1
    from public.sites site
    where site.id = site_members.site_id
      and (select public.is_company_manager(site.company_id))
  )
);

drop policy if exists "site members deletable by managers" on public.site_members;
create policy "site members deletable by managers"
on public.site_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.sites site
    where site.id = site_members.site_id
      and (select public.is_company_manager(site.company_id))
  )
);

drop policy if exists "duties visible to site members" on public.cleaning_duties;
drop policy if exists "duties visible by role" on public.cleaning_duties;
create policy "duties visible by role"
on public.cleaning_duties
for select
to authenticated
using ((select public.can_access_duty(id)));

drop policy if exists "duties insertable by managers" on public.cleaning_duties;
drop policy if exists "duties insertable by site managers" on public.cleaning_duties;
create policy "duties insertable by site managers"
on public.cleaning_duties
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select public.can_manage_site(site_id))
);

drop policy if exists "duties updatable by managers or assignees" on public.cleaning_duties;
drop policy if exists "duties updatable by site managers or assignees" on public.cleaning_duties;
create policy "duties updatable by site managers or assignees"
on public.cleaning_duties
for update
to authenticated
using (
  (select public.can_manage_site(site_id))
  or (select public.is_duty_assignee(id))
)
with check (
  (select public.can_manage_site(site_id))
  or (select public.is_duty_assignee(id))
);

drop policy if exists "duties deletable by managers" on public.cleaning_duties;
create policy "duties deletable by site managers"
on public.cleaning_duties
for delete
to authenticated
using ((select public.can_manage_site(site_id)));

drop policy if exists "assignments visible to duty members" on public.duty_assignments;
drop policy if exists "assignments visible by duty access" on public.duty_assignments;
create policy "assignments visible by duty access"
on public.duty_assignments
for select
to authenticated
using ((select public.can_access_duty(duty_id)));

drop policy if exists "assignments editable by managers" on public.duty_assignments;
drop policy if exists "assignments insertable by site managers" on public.duty_assignments;
create policy "assignments insertable by site managers"
on public.duty_assignments
for insert
to authenticated
with check (
  assigned_by = (select auth.uid())
  and (select public.can_assign_cleaner_to_duty(duty_id, profile_id))
);

drop policy if exists "assignments deletable by managers" on public.duty_assignments;
drop policy if exists "assignments deletable by site managers" on public.duty_assignments;
create policy "assignments deletable by site managers"
on public.duty_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.cleaning_duties duty
    where duty.id = duty_assignments.duty_id
      and (select public.can_manage_site(duty.site_id))
  )
);

drop policy if exists "comments visible to site members" on public.duty_comments;
create policy "comments visible by duty access"
on public.duty_comments
for select
to authenticated
using ((select public.can_access_duty(duty_id)));

drop policy if exists "comments insertable by site members" on public.duty_comments;
create policy "comments insertable by duty access"
on public.duty_comments
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and (select public.can_access_duty(duty_id))
);

drop policy if exists "photos visible to site members" on public.duty_photos;
create policy "photos visible by duty access"
on public.duty_photos
for select
to authenticated
using ((select public.can_access_duty(duty_id)));

drop policy if exists "photos insertable by site members" on public.duty_photos;
create policy "photos insertable by duty access"
on public.duty_photos
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select public.can_access_duty(duty_id))
);

drop policy if exists "incidents visible to company members" on public.incidents;
create policy "incidents visible by site access"
on public.incidents
for select
to authenticated
using ((select public.can_access_site(site_id)));

drop policy if exists "incidents insertable by site members" on public.incidents;
create policy "incidents insertable by site access"
on public.incidents
for insert
to authenticated
with check (
  reported_by = (select auth.uid())
  and (select public.can_access_site(site_id))
);

drop policy if exists "activity logs visible to company members" on public.activity_logs;
create policy "activity logs visible to managers"
on public.activity_logs
for select
to authenticated
using ((select public.is_company_manager(company_id)));

drop policy if exists "service reports visible to company members" on public.service_reports;
create policy "service reports visible by site access"
on public.service_reports
for select
to authenticated
using (
  (select public.is_company_manager(company_id))
  or (
    site_id is not null
    and (select public.can_manage_site(site_id))
  )
);

drop policy if exists "service reports insertable by managers" on public.service_reports;
create policy "service reports insertable by site managers"
on public.service_reports
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select public.is_company_manager(company_id))
    or (
      site_id is not null
      and (select public.can_manage_site(site_id))
    )
  )
  and (
    site_id is null
    or exists (
      select 1
      from public.sites site
      where site.id = service_reports.site_id
        and site.company_id = service_reports.company_id
    )
  )
);

drop policy if exists "service reports deletable by managers" on public.service_reports;
create policy "service reports deletable by site managers"
on public.service_reports
for delete
to authenticated
using (
  (select public.is_company_manager(company_id))
  or (
    site_id is not null
    and (select public.can_manage_site(site_id))
  )
);

drop policy if exists "preloaded duties visible to company managers" on public.preloaded_duties;
create policy "preloaded duties visible to company staff"
on public.preloaded_duties
for select
to authenticated
using ((select public.is_company_staff(company_id)));

drop policy if exists "preloaded duties insertable by company managers" on public.preloaded_duties;
create policy "preloaded duties insertable by company managers"
on public.preloaded_duties
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select public.is_company_manager(company_id))
);

drop policy if exists "preloaded duties updatable by company managers" on public.preloaded_duties;
create policy "preloaded duties updatable by company managers"
on public.preloaded_duties
for update
to authenticated
using ((select public.is_company_manager(company_id)))
with check ((select public.is_company_manager(company_id)));

drop policy if exists "preloaded duties deletable by company managers" on public.preloaded_duties;
create policy "preloaded duties deletable by company managers"
on public.preloaded_duties
for delete
to authenticated
using ((select public.is_company_manager(company_id)));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_full_name text;
  v_phone text;
  v_role public.user_role;
  v_site_id uuid;
  v_invited_company_id uuid;
begin
  v_full_name := coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email, new.phone, 'New User');
  v_phone := new.phone;
  v_invited_company_id := nullif(new.raw_app_meta_data->>'company_id', '')::uuid;

  if v_invited_company_id is null then
    v_role := 'Manager';
    insert into public.companies (name)
    values (coalesce(nullif(btrim(new.raw_user_meta_data->>'company_name'), ''), 'New Company'))
    returning id into v_company_id;
  else
    v_company_id := v_invited_company_id;
    v_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'Cleaner');

    if v_role not in ('Supervisor', 'Cleaner') then
      raise exception 'Invited users must be Supervisors or Cleaners';
    end if;

    if not exists (select 1 from public.companies company where company.id = v_company_id) then
      raise exception 'Invitation company does not exist';
    end if;
  end if;

  insert into public.profiles (id, company_id, full_name, email, phone, role)
  values (new.id, v_company_id, v_full_name, new.email, v_phone, v_role)
  on conflict (id) do update
    set company_id = excluded.company_id,
        full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        role = excluded.role,
        updated_at = now();

  if v_role in ('Supervisor', 'Cleaner') then
    for v_site_id in
      select site.id
      from public.sites site
      where site.company_id = v_company_id
        and exists (
          select 1
          from jsonb_array_elements_text(coalesce(new.raw_app_meta_data->'site_ids', '[]'::jsonb)) site_ids(site_id)
          where site_ids.site_id::uuid = site.id
        )
    loop
      insert into public.site_members (site_id, profile_id, role)
      values (v_site_id, new.id, v_role)
      on conflict (site_id, profile_id) do update
        set role = excluded.role;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create or replace function public.advance_duty_schedule(p_duty_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duty public.cleaning_duties%rowtype;
  v_rule jsonb;
  v_pattern text;
  v_next_start timestamptz;
  v_next_due timestamptz;
  v_shift_duration interval;
  v_day_offset integer;
  v_next_id uuid;
  v_final_status public.duty_status;
begin
  select *
  into v_duty
  from public.cleaning_duties
  where id = p_duty_id
  for update;

  if not found then
    return null;
  end if;

  if not public.can_access_duty(v_duty.id) then
    raise exception 'Not authorized to advance this duty';
  end if;

  if v_duty.starts_at is not null
    and v_duty.starts_at <= now()
    and (v_duty.due_date is null or v_duty.due_date > now())
    and v_duty.status::text = 'Scheduled' then
    update public.cleaning_duties
    set status = 'Pending', updated_at = now()
    where id = v_duty.id;
    return null;
  end if;

  if v_duty.due_date is null or v_duty.due_date > now() then
    return null;
  end if;

  if not v_duty.recurring then
    if v_duty.status::text in ('Draft', 'Scheduled', 'Pending', 'In Progress') then
      update public.cleaning_duties
      set status = case
        when v_duty.status::text = 'In Progress' then 'Incomplete'::public.duty_status
        else 'Missed'::public.duty_status
      end,
      updated_at = now()
      where id = v_duty.id;
    end if;
    return null;
  end if;

  if v_duty.status::text in ('Archived', 'Missed', 'Incomplete') then
    select id into v_next_id
    from public.cleaning_duties
    where previous_duty_id = v_duty.id;
    return v_next_id;
  end if;

  begin
    v_rule := coalesce(v_duty.recurring_rule::jsonb, '{"pattern":"daily","weekdays":[1]}'::jsonb);
  exception when others then
    v_rule := '{"pattern":"daily","weekdays":[1]}'::jsonb;
  end;
  v_pattern := coalesce(v_rule->>'pattern', 'daily');

  v_next_start := coalesce(v_duty.starts_at, v_duty.due_date);
  v_shift_duration := case
    when v_duty.starts_at is not null and v_duty.due_date is not null then v_duty.due_date - v_duty.starts_at
    else interval '0 seconds'
  end;

  loop
    if v_pattern = 'weekly' then
      select min(day_offset)
      into v_day_offset
      from generate_series(1, 7) as day_offset
      where exists (
        select 1
        from jsonb_array_elements_text(coalesce(v_rule->'weekdays', '[1]'::jsonb)) as weekday(value)
        where weekday.value::integer = extract(dow from v_next_start + day_offset * interval '1 day')::integer
      );
      v_next_start := v_next_start + coalesce(v_day_offset, 7) * interval '1 day';
    elsif v_pattern = 'monthly' then
      v_next_start := v_next_start + interval '1 month';
    elsif v_pattern = 'yearly' then
      v_next_start := v_next_start + interval '1 year';
    else
      v_next_start := v_next_start + interval '1 day';
    end if;

    v_next_due := case
      when v_duty.starts_at is not null then v_next_start + v_shift_duration
      else v_next_start
    end;

    exit when v_next_due > now();
  end loop;

  v_final_status := case
    when v_duty.status::text = 'Completed' then 'Archived'::public.duty_status
    when v_duty.status::text = 'In Progress' then 'Incomplete'::public.duty_status
    else 'Missed'::public.duty_status
  end;

  update public.cleaning_duties
  set status = v_final_status, updated_at = now()
  where id = v_duty.id;

  insert into public.cleaning_duties (
    site_id,
    created_by,
    title,
    description,
    priority,
    status,
    starts_at,
    due_date,
    recurring,
    recurring_rule,
    equipment,
    reference_photos,
    previous_duty_id
  ) values (
    v_duty.site_id,
    v_duty.created_by,
    v_duty.title,
    v_duty.description,
    v_duty.priority,
    'Scheduled',
    case when v_duty.starts_at is not null then v_next_start else null end,
    v_next_due,
    true,
    v_duty.recurring_rule,
    v_duty.equipment,
    v_duty.reference_photos,
    v_duty.id
  )
  on conflict (previous_duty_id) where previous_duty_id is not null do nothing
  returning id into v_next_id;

  if v_next_id is null then
    select id into v_next_id
    from public.cleaning_duties
    where previous_duty_id = v_duty.id;
    return v_next_id;
  end if;

  insert into public.duty_assignments (duty_id, profile_id, assigned_by)
  select v_next_id, profile_id, assigned_by
  from public.duty_assignments
  where duty_id = v_duty.id
  on conflict (duty_id, profile_id) do nothing;

  return v_next_id;
end;
$$;

revoke all on function public.advance_duty_schedule(uuid) from public;
grant execute on function public.advance_duty_schedule(uuid) to authenticated, service_role;
