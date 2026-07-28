alter table public.sites
  add column if not exists shift_start_time time,
  add column if not exists shift_end_time time;

update public.sites
set
  shift_start_time = '22:00'::time,
  shift_end_time = '07:00'::time,
  updated_at = now()
where company_id = '509d3a7e-f7a2-4f5e-8b96-877c2c58011a'::uuid
  and id = '9d43ca7a-abfb-4ad7-b0be-252276ee2b60'::uuid;

update public.sites
set
  shift_start_time = '18:00'::time,
  shift_end_time = '02:00'::time,
  updated_at = now()
where company_id = '8f96e6c9-cdb0-41e9-a540-c92f888e0694'::uuid;
