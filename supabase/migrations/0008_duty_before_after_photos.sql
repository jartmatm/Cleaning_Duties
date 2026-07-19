alter table public.cleaning_duties
  add column if not exists before_photos text[] not null default '{}'::text[],
  add column if not exists after_photos text[] not null default '{}'::text[];
