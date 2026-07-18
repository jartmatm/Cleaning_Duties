alter table public.companies
add column if not exists logo_url text,
add column if not exists color_palette text not null default 'midnight';

insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "company assets are publicly readable" on storage.objects;
create policy "company assets are publicly readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'company-assets');

drop policy if exists "company managers can upload company assets" on storage.objects;
create policy "company managers can upload company assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and public.is_company_manager((storage.foldername(name))[1]::uuid)
);

drop policy if exists "company managers can update company assets" on storage.objects;
create policy "company managers can update company assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-assets'
  and public.is_company_manager((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'company-assets'
  and public.is_company_manager((storage.foldername(name))[1]::uuid)
);

drop policy if exists "company managers can delete company assets" on storage.objects;
create policy "company managers can delete company assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and public.is_company_manager((storage.foldername(name))[1]::uuid)
);
