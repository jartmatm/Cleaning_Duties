create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_full_name text;
  v_phone text;
  v_role public.user_role;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.email, new.phone, 'New User');
  v_phone := new.phone;
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'Cleaner');

  v_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;

  if v_company_id is null then
    insert into public.companies (name)
    values (coalesce(new.raw_user_meta_data->>'company_name', 'New Company'))
    returning id into v_company_id;
  end if;

  insert into public.profiles (id, company_id, full_name, phone, role)
  values (new.id, v_company_id, v_full_name, v_phone, v_role)
  on conflict (id) do update
    set company_id = excluded.company_id,
        full_name = excluded.full_name,
        phone = excluded.phone,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
