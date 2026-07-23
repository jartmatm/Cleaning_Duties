create table if not exists public.service_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  date_from date not null,
  date_to date not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_reports_company_id on public.service_reports(company_id);
create index if not exists idx_service_reports_site_id on public.service_reports(site_id);
create index if not exists idx_service_reports_created_at on public.service_reports(created_at);

alter table public.service_reports enable row level security;

drop policy if exists "service reports visible to company members" on public.service_reports;
create policy "service reports visible to company members"
on public.service_reports
for select
using (public.is_company_member(company_id));

drop policy if exists "service reports insertable by managers" on public.service_reports;
create policy "service reports insertable by managers"
on public.service_reports
for insert
with check (public.is_company_manager(company_id));
