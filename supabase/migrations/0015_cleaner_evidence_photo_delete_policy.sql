drop policy if exists "site members can delete their duty evidence objects" on storage.objects;
create policy "site members can delete their duty evidence objects"
on storage.objects
for delete
using (
  owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.sites s
    where s.storage_bucket = storage.objects.bucket_id
      and (storage.foldername(storage.objects.name))[1] = s.id::text
      and (storage.foldername(storage.objects.name))[2] in ('before', 'after')
      and public.is_site_member(s.id)
  )
);
