create policy "Managers can create company data export settings"
on public.company_data_exports
for insert
to authenticated
with check ((select public.is_company_manager(company_id)));

create policy "Managers can update company data export settings"
on public.company_data_exports
for update
to authenticated
using ((select public.is_company_manager(company_id)))
with check ((select public.is_company_manager(company_id)));

grant insert (
  company_id,
  enabled,
  format,
  periodicity,
  interval_days,
  schedule_started_at,
  next_run_at,
  updated_at
) on public.company_data_exports to authenticated;

grant update (
  enabled,
  format,
  periodicity,
  interval_days,
  schedule_started_at,
  next_run_at,
  updated_at
) on public.company_data_exports to authenticated;

alter function public.update_company_data_export_settings(uuid, boolean, text, text, integer)
  security invoker;
