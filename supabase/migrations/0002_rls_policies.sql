create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = target_company_id
  );
$$;

create or replace function public.is_site_member(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_members sm
    where sm.site_id = target_site_id
      and sm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_company_manager(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = target_company_id
      and p.role in ('Owner', 'Manager')
  );
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_members enable row level security;
alter table public.cleaning_duties enable row level security;
alter table public.duty_assignments enable row level security;
alter table public.duty_comments enable row level security;
alter table public.duty_photos enable row level security;
alter table public.incidents enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles can read own row" on public.profiles;
create policy "profiles can read own row"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles company members can read profiles" on public.profiles;
create policy "profiles company members can read profiles"
on public.profiles
for select
using (public.is_company_member(company_id));

drop policy if exists "profiles can update own row" on public.profiles;
create policy "profiles can update own row"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "companies visible to members" on public.companies;
create policy "companies visible to members"
on public.companies
for select
using (public.is_company_member(id));

drop policy if exists "companies editable by owners" on public.companies;
create policy "companies editable by owners"
on public.companies
for update
using (public.is_company_manager(id))
with check (public.is_company_manager(id));

drop policy if exists "sites visible to company members" on public.sites;
create policy "sites visible to company members"
on public.sites
for select
using (public.is_company_member(company_id));

drop policy if exists "sites editable by managers" on public.sites;
create policy "sites editable by managers"
on public.sites
for insert
with check (public.is_company_manager(company_id));

drop policy if exists "sites updatable by managers" on public.sites;
create policy "sites updatable by managers"
on public.sites
for update
using (public.is_company_manager(company_id))
with check (public.is_company_manager(company_id));

drop policy if exists "sites deletable by managers" on public.sites;
create policy "sites deletable by managers"
on public.sites
for delete
using (public.is_company_manager(company_id));

drop policy if exists "site members visible to company members" on public.site_members;
create policy "site members visible to company members"
on public.site_members
for select
using (
  exists (
    select 1
    from public.sites s
    where s.id = site_members.site_id
      and public.is_company_member(s.company_id)
  )
);

drop policy if exists "site members editable by managers" on public.site_members;
create policy "site members editable by managers"
on public.site_members
for insert
with check (
  exists (
    select 1
    from public.sites s
    where s.id = site_members.site_id
      and public.is_company_manager(s.company_id)
  )
);

drop policy if exists "site members updatable by managers" on public.site_members;
create policy "site members updatable by managers"
on public.site_members
for update
using (
  exists (
    select 1
    from public.sites s
    where s.id = site_members.site_id
      and public.is_company_manager(s.company_id)
  )
)
with check (
  exists (
    select 1
    from public.sites s
    where s.id = site_members.site_id
      and public.is_company_manager(s.company_id)
  )
);

drop policy if exists "duties visible to site members" on public.cleaning_duties;
create policy "duties visible to site members"
on public.cleaning_duties
for select
using (public.is_site_member(site_id) or public.is_company_member((select company_id from public.sites where id = site_id)));

drop policy if exists "duties insertable by managers" on public.cleaning_duties;
create policy "duties insertable by managers"
on public.cleaning_duties
for insert
with check (
  exists (
    select 1
    from public.sites s
    where s.id = cleaning_duties.site_id
      and public.is_company_manager(s.company_id)
  )
);

drop policy if exists "duties updatable by managers or assignees" on public.cleaning_duties;
create policy "duties updatable by managers or assignees"
on public.cleaning_duties
for update
using (
  exists (
    select 1
    from public.sites s
    where s.id = cleaning_duties.site_id
      and public.is_company_member(s.company_id)
  )
)
with check (
  exists (
    select 1
    from public.sites s
    where s.id = cleaning_duties.site_id
      and public.is_company_member(s.company_id)
  )
);

drop policy if exists "assignments visible to duty members" on public.duty_assignments;
create policy "assignments visible to duty members"
on public.duty_assignments
for select
using (
  exists (
    select 1
    from public.cleaning_duties d
    where d.id = duty_assignments.duty_id
      and (public.is_site_member(d.site_id) or public.is_company_member((select company_id from public.sites where id = d.site_id)))
  )
);

drop policy if exists "assignments editable by managers" on public.duty_assignments;
create policy "assignments editable by managers"
on public.duty_assignments
for insert
with check (
  exists (
    select 1
    from public.cleaning_duties d
    join public.sites s on s.id = d.site_id
    where d.id = duty_assignments.duty_id
      and public.is_company_manager(s.company_id)
  )
);

drop policy if exists "comments visible to site members" on public.duty_comments;
create policy "comments visible to site members"
on public.duty_comments
for select
using (
  exists (
    select 1
    from public.cleaning_duties d
    where d.id = duty_comments.duty_id
      and public.is_site_member(d.site_id)
  )
);

drop policy if exists "comments insertable by site members" on public.duty_comments;
create policy "comments insertable by site members"
on public.duty_comments
for insert
with check (
  exists (
    select 1
    from public.cleaning_duties d
    where d.id = duty_comments.duty_id
      and public.is_site_member(d.site_id)
  )
);

drop policy if exists "photos visible to site members" on public.duty_photos;
create policy "photos visible to site members"
on public.duty_photos
for select
using (
  exists (
    select 1
    from public.cleaning_duties d
    where d.id = duty_photos.duty_id
      and public.is_site_member(d.site_id)
  )
);

drop policy if exists "photos insertable by site members" on public.duty_photos;
create policy "photos insertable by site members"
on public.duty_photos
for insert
with check (
  exists (
    select 1
    from public.cleaning_duties d
    where d.id = duty_photos.duty_id
      and public.is_site_member(d.site_id)
  )
);

drop policy if exists "incidents visible to company members" on public.incidents;
create policy "incidents visible to company members"
on public.incidents
for select
using (
  exists (
    select 1
    from public.sites s
    where s.id = incidents.site_id
      and public.is_company_member(s.company_id)
  )
);

drop policy if exists "incidents insertable by site members" on public.incidents;
create policy "incidents insertable by site members"
on public.incidents
for insert
with check (
  exists (
    select 1
    from public.sites s
    where s.id = incidents.site_id
      and public.is_company_member(s.company_id)
  )
);

drop policy if exists "notifications visible to owner" on public.notifications;
create policy "notifications visible to owner"
on public.notifications
for select
using (profile_id = auth.uid());

drop policy if exists "notifications updatable by owner" on public.notifications;
create policy "notifications updatable by owner"
on public.notifications
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "activity logs visible to company members" on public.activity_logs;
create policy "activity logs visible to company members"
on public.activity_logs
for select
using (public.is_company_member(company_id));
