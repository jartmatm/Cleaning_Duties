drop policy if exists "site storage objects are publicly readable" on storage.objects;
create policy "site storage objects are publicly readable"
on storage.objects
for select
using (
  exists (
    select 1
    from public.sites s
    where s.storage_bucket = storage.objects.bucket_id
  )
);

drop policy if exists "site members can upload site storage objects" on storage.objects;
create policy "site members can upload site storage objects"
on storage.objects
for insert
with check (
  exists (
    select 1
    from public.sites s
    where s.storage_bucket = storage.objects.bucket_id
      and (storage.foldername(storage.objects.name))[1] = s.id::text
      and (
        public.is_site_member(s.id)
        or public.is_company_manager(s.company_id)
      )
  )
);

drop policy if exists "site members can update site storage objects" on storage.objects;
create policy "site members can update site storage objects"
on storage.objects
for update
using (
  exists (
    select 1
    from public.sites s
    where s.storage_bucket = storage.objects.bucket_id
      and (storage.foldername(storage.objects.name))[1] = s.id::text
      and (
        public.is_site_member(s.id)
        or public.is_company_manager(s.company_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.sites s
    where s.storage_bucket = storage.objects.bucket_id
      and (storage.foldername(storage.objects.name))[1] = s.id::text
      and (
        public.is_site_member(s.id)
        or public.is_company_manager(s.company_id)
      )
  )
);

drop policy if exists "site managers can delete site storage objects" on storage.objects;
create policy "site managers can delete site storage objects"
on storage.objects
for delete
using (
  exists (
    select 1
    from public.sites s
    where s.storage_bucket = storage.objects.bucket_id
      and (storage.foldername(storage.objects.name))[1] = s.id::text
      and public.is_company_manager(s.company_id)
  )
);
