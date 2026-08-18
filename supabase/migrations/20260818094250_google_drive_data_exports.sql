create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists supabase_vault with schema vault;

create table public.company_data_exports (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  format text not null default 'google_sheets'
    check (format in ('google_sheets', 'csv', 'json')),
  periodicity text not null default 'daily'
    check (periodicity in ('daily', 'weekly', 'monthly', 'custom')),
  interval_days integer not null default 1
    check (interval_days between 1 and 999),
  schedule_started_at date not null default current_date,
  next_run_at timestamptz,
  google_email text,
  google_file_id text,
  google_file_url text,
  google_file_mime_type text,
  connected_at timestamptz,
  last_exported_at timestamptz,
  last_export_status text not null default 'idle'
    check (last_export_status in ('idle', 'running', 'success', 'failed')),
  last_export_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_data_exports_due_idx
  on public.company_data_exports (next_run_at)
  where enabled and connected_at is not null;

alter table public.company_data_exports enable row level security;

create policy "Managers can view company data exports"
on public.company_data_exports
for select
to authenticated
using ((select public.is_company_manager(company_id)));

revoke all on table public.company_data_exports from public, anon, authenticated;
grant select on table public.company_data_exports to authenticated;
grant all on table public.company_data_exports to service_role;

create table public.google_drive_oauth_states (
  state_hash text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index google_drive_oauth_states_expires_idx
  on public.google_drive_oauth_states (expires_at);

alter table public.google_drive_oauth_states enable row level security;
revoke all on table public.google_drive_oauth_states from public, anon, authenticated;
grant all on table public.google_drive_oauth_states to service_role;

create table public.company_data_export_credentials (
  company_id uuid primary key references public.companies(id) on delete cascade,
  refresh_token_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_data_export_credentials enable row level security;
revoke all on table public.company_data_export_credentials from public, anon, authenticated;
grant all on table public.company_data_export_credentials to service_role;

create or replace function public.update_company_data_export_settings(
  p_company_id uuid,
  p_enabled boolean,
  p_format text,
  p_periodicity text,
  p_interval_days integer default 1
)
returns public.company_data_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_settings public.company_data_exports;
  updated_settings public.company_data_exports;
  normalized_interval integer;
  schedule_changed boolean;
begin
  if (select auth.uid()) is null
    or not (select public.is_company_manager(p_company_id)) then
    raise exception 'Only the company manager can update data exports';
  end if;

  if p_format not in ('google_sheets', 'csv', 'json') then
    raise exception 'Unsupported export format';
  end if;

  if p_periodicity not in ('daily', 'weekly', 'monthly', 'custom') then
    raise exception 'Unsupported export periodicity';
  end if;

  normalized_interval := case
    when p_periodicity = 'custom' then least(greatest(coalesce(p_interval_days, 1), 1), 999)
    else 1
  end;

  select *
  into existing_settings
  from public.company_data_exports
  where company_id = p_company_id;

  schedule_changed := existing_settings.company_id is null
    or existing_settings.periodicity <> p_periodicity
    or existing_settings.interval_days <> normalized_interval
    or (p_enabled and not existing_settings.enabled);

  insert into public.company_data_exports (
    company_id,
    enabled,
    format,
    periodicity,
    interval_days,
    schedule_started_at,
    next_run_at,
    updated_at
  )
  values (
    p_company_id,
    p_enabled,
    p_format,
    p_periodicity,
    normalized_interval,
    current_date,
    case when p_enabled then now() else null end,
    now()
  )
  on conflict (company_id) do update
  set enabled = excluded.enabled,
      format = excluded.format,
      periodicity = excluded.periodicity,
      interval_days = excluded.interval_days,
      schedule_started_at = case
        when schedule_changed then current_date
        else public.company_data_exports.schedule_started_at
      end,
      next_run_at = case
        when not excluded.enabled then null
        when schedule_changed then now()
        else public.company_data_exports.next_run_at
      end,
      updated_at = now()
  returning * into updated_settings;

  return updated_settings;
end;
$$;

revoke all on function public.update_company_data_export_settings(uuid, boolean, text, text, integer)
  from public, anon;
grant execute on function public.update_company_data_export_settings(uuid, boolean, text, text, integer)
  to authenticated, service_role;

create or replace function public.store_company_google_refresh_token(
  p_company_id uuid,
  p_refresh_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_secret_id uuid;
  new_secret_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if nullif(trim(p_refresh_token), '') is null then
    raise exception 'Refresh token is required';
  end if;

  select refresh_token_secret_id
  into existing_secret_id
  from public.company_data_export_credentials
  where company_id = p_company_id;

  if existing_secret_id is null then
    select vault.create_secret(
      p_refresh_token,
      'google-drive-refresh-' || p_company_id::text,
      'Google Drive OAuth refresh token for Cleaning Duties data exports'
    )
    into new_secret_id;
  else
    perform vault.update_secret(existing_secret_id, p_refresh_token);
    new_secret_id := existing_secret_id;
  end if;

  insert into public.company_data_export_credentials (
    company_id,
    refresh_token_secret_id,
    updated_at
  )
  values (p_company_id, new_secret_id, now())
  on conflict (company_id) do update
  set refresh_token_secret_id = excluded.refresh_token_secret_id,
      updated_at = now();
end;
$$;

create or replace function public.get_company_google_refresh_token(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  refresh_token text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select secrets.decrypted_secret
  into refresh_token
  from public.company_data_export_credentials credentials
  join vault.decrypted_secrets secrets
    on secrets.id = credentials.refresh_token_secret_id
  where credentials.company_id = p_company_id;

  return refresh_token;
end;
$$;

create or replace function public.delete_company_google_refresh_token(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  delete from public.company_data_export_credentials
  where company_id = p_company_id
  returning refresh_token_secret_id into secret_id;

  if secret_id is not null then
    delete from vault.secrets where id = secret_id;
  end if;
end;
$$;

create or replace function public.get_data_export_cron_secret()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cron_secret text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'cleaning_duties_data_export_cron_secret';

  return cron_secret;
end;
$$;

revoke all on function public.store_company_google_refresh_token(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_company_google_refresh_token(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_company_google_refresh_token(uuid)
  from public, anon, authenticated;
revoke all on function public.get_data_export_cron_secret()
  from public, anon, authenticated;

grant execute on function public.store_company_google_refresh_token(uuid, text) to service_role;
grant execute on function public.get_company_google_refresh_token(uuid) to service_role;
grant execute on function public.delete_company_google_refresh_token(uuid) to service_role;
grant execute on function public.get_data_export_cron_secret() to service_role;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'cleaning_duties_project_url'
  ) then
    perform vault.create_secret(
      'https://rbkrhaylmxnddwupetck.supabase.co',
      'cleaning_duties_project_url',
      'Supabase project URL used by scheduled Cleaning Duties exports'
    );
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'cleaning_duties_data_export_cron_secret'
  ) then
    perform vault.create_secret(
      gen_random_uuid()::text || gen_random_uuid()::text,
      'cleaning_duties_data_export_cron_secret',
      'Authentication secret for the scheduled Google Drive export function'
    );
  end if;
end;
$$;

select cron.schedule(
  'cleaning-duties-google-drive-exports',
  '15 * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cleaning_duties_project_url'
      ) || '/functions/v1/google-drive-export',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'action', 'run_due',
        'cronSecret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cleaning_duties_data_export_cron_secret'
        )
      ),
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);
