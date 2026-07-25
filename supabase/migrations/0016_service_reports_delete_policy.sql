drop policy if exists "service reports deletable by managers" on public.service_reports;
create policy "service reports deletable by managers"
on public.service_reports
for delete
using (public.is_company_manager(company_id));
