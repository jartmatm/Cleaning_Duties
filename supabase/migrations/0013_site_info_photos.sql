alter table public.sites
add column if not exists info_photos text[] not null default '{}'::text[];
