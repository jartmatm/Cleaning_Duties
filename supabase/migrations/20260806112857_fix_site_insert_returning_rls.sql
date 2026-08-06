drop policy if exists "sites visible by role" on public.sites;

create policy "sites visible by role"
on public.sites
for select
to authenticated
using (
  (select public.is_company_manager(company_id))
  or (select public.is_site_member(id))
);
