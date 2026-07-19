drop policy if exists "duties deletable by managers" on public.cleaning_duties;
create policy "duties deletable by managers"
on public.cleaning_duties
for delete
using (
  exists (
    select 1
    from public.sites s
    where s.id = cleaning_duties.site_id
      and public.is_company_manager(s.company_id)
  )
);
