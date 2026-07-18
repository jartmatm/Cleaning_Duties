drop policy if exists "assignments deletable by managers" on public.duty_assignments;
create policy "assignments deletable by managers"
on public.duty_assignments
for delete
using (
  exists (
    select 1
    from public.cleaning_duties d
    join public.sites s on s.id = d.site_id
    where d.id = duty_assignments.duty_id
      and public.is_company_manager(s.company_id)
  )
);
