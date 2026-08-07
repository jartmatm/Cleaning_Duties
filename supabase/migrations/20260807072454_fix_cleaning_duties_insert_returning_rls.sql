drop policy if exists "duties visible by role" on public.cleaning_duties;

-- Avoid the self-referential duty lookup that blocks INSERT ... RETURNING.
create policy "duties visible by role"
on public.cleaning_duties
for select
to authenticated
using (
  (select public.can_manage_site(site_id))
  or (select public.is_duty_assignee(id))
);
