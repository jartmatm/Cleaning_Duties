alter table public.sites
  add column if not exists shift_start_time time,
  add column if not exists shift_end_time time;
