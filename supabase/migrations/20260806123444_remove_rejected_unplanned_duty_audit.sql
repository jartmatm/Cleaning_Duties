create or replace function public.remove_rejected_unplanned_duty_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_logs
  where entity_type = 'unplanned_duty_request'
    and entity_id = old.id
    and action = 'rejected_unplanned_duty';

  return old;
end;
$$;

revoke all on function public.remove_rejected_unplanned_duty_audit() from public;

drop trigger if exists remove_rejected_unplanned_duty_audit on public.unplanned_duty_requests;
create trigger remove_rejected_unplanned_duty_audit
after delete on public.unplanned_duty_requests
for each row execute function public.remove_rejected_unplanned_duty_audit();
