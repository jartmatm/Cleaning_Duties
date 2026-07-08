create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('Owner', 'Manager', 'Cleaner');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.duty_status as enum ('Draft', 'Pending', 'In Progress', 'Completed', 'Incomplete', 'Overdue');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.duty_priority as enum ('Urgent', 'High', 'Medium', 'Low', 'Periodical');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.incident_type as enum (
    'Broken Equipment',
    'Customer Complaint',
    'Chemical Spill',
    'Broken Glass',
    'Maintenance Required',
    'Other'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.user_role not null default 'Cleaner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_members (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (site_id, profile_id)
);

create table if not exists public.cleaning_duties (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text not null default '',
  priority public.duty_priority not null default 'Medium',
  status public.duty_status not null default 'Draft',
  due_date timestamptz,
  recurring boolean not null default false,
  recurring_rule text,
  equipment text[] not null default '{}'::text[],
  reference_photos text[] not null default '{}'::text[],
  completion_photos text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.duty_assignments (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.cleaning_duties(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (duty_id, profile_id)
);

create table if not exists public.duty_comments (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.cleaning_duties(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.duty_photos (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.cleaning_duties(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  photo_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid references public.cleaning_duties(id) on delete set null,
  site_id uuid not null references public.sites(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  incident_type public.incident_type not null,
  details text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_company_id on public.profiles(company_id);
create index if not exists idx_sites_company_id on public.sites(company_id);
create index if not exists idx_site_members_site_id on public.site_members(site_id);
create index if not exists idx_site_members_profile_id on public.site_members(profile_id);
create index if not exists idx_duties_site_id on public.cleaning_duties(site_id);
create index if not exists idx_duties_status on public.cleaning_duties(status);
create index if not exists idx_duties_due_date on public.cleaning_duties(due_date);
create index if not exists idx_assignments_duty_id on public.duty_assignments(duty_id);
create index if not exists idx_assignments_profile_id on public.duty_assignments(profile_id);
create index if not exists idx_comments_duty_id on public.duty_comments(duty_id);
create index if not exists idx_photos_duty_id on public.duty_photos(duty_id);
create index if not exists idx_incidents_site_id on public.incidents(site_id);
create index if not exists idx_notifications_profile_id on public.notifications(profile_id);
create index if not exists idx_activity_logs_company_id on public.activity_logs(company_id);
