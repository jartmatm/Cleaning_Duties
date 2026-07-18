alter table public.sites
add column if not exists storage_bucket text not null default '';

update public.sites
set storage_bucket = concat('site-', id::text)
where storage_bucket = '';

insert into storage.buckets (id, name, public)
select storage_bucket, storage_bucket, true
from public.sites
where storage_bucket <> ''
on conflict (id) do nothing;

create or replace function public.ensure_site_storage_bucket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.storage_bucket = '' or new.storage_bucket is null then
    new.storage_bucket := concat('site-', new.id::text);
  end if;

  insert into storage.buckets (id, name, public)
  values (new.storage_bucket, new.storage_bucket, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists set_site_storage_bucket on public.sites;
create trigger set_site_storage_bucket
before insert on public.sites
for each row execute procedure public.ensure_site_storage_bucket();
