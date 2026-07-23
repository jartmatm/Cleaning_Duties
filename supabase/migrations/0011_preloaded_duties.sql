create table if not exists public.preloaded_duties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text not null default '',
  priority public.duty_priority not null default 'Medium',
  status public.duty_status not null default 'Draft',
  equipment text[] not null default '{}'::text[],
  reference_photos text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_preloaded_duties_company_id on public.preloaded_duties(company_id);
create index if not exists idx_preloaded_duties_title on public.preloaded_duties using gin (to_tsvector('english', title));

alter table public.preloaded_duties enable row level security;

drop policy if exists "preloaded duties visible to company managers" on public.preloaded_duties;
create policy "preloaded duties visible to company managers"
on public.preloaded_duties
for select
using (public.is_company_manager(company_id));

drop policy if exists "preloaded duties insertable by company managers" on public.preloaded_duties;
create policy "preloaded duties insertable by company managers"
on public.preloaded_duties
for insert
with check (public.is_company_manager(company_id));

drop policy if exists "preloaded duties updatable by company managers" on public.preloaded_duties;
create policy "preloaded duties updatable by company managers"
on public.preloaded_duties
for update
using (public.is_company_manager(company_id))
with check (public.is_company_manager(company_id));

drop policy if exists "preloaded duties deletable by company managers" on public.preloaded_duties;
create policy "preloaded duties deletable by company managers"
on public.preloaded_duties
for delete
using (public.is_company_manager(company_id));
