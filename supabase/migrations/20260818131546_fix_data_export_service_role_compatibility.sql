-- Supabase secret API keys are mapped to the service_role database role but are
-- not JWTs, so request.jwt.claim.role is empty for those requests. Execution
-- privileges are the authorization boundary for these Vault helpers.

create or replace function public.store_data_export_anon_key(p_anon_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if nullif(trim(p_anon_key), '') is null then
    raise exception 'Supabase anon key is required';
  end if;

  select id
  into secret_id
  from vault.secrets
  where name = 'cleaning_duties_data_export_anon_key';

  if secret_id is null then
    perform vault.create_secret(
      p_anon_key,
      'cleaning_duties_data_export_anon_key',
      'Supabase anon JWT used by the scheduled data export request'
    );
  else
    perform vault.update_secret(secret_id, p_anon_key);
  end if;
end;
$$;

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
  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'cleaning_duties_data_export_cron_secret';

  return cron_secret;
end;
$$;

revoke all on function public.store_data_export_anon_key(text)
  from public, anon, authenticated;
revoke all on function public.store_company_google_refresh_token(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_company_google_refresh_token(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_company_google_refresh_token(uuid)
  from public, anon, authenticated;
revoke all on function public.get_data_export_cron_secret()
  from public, anon, authenticated;

grant execute on function public.store_data_export_anon_key(text) to service_role;
grant execute on function public.store_company_google_refresh_token(uuid, text) to service_role;
grant execute on function public.get_company_google_refresh_token(uuid) to service_role;
grant execute on function public.delete_company_google_refresh_token(uuid) to service_role;
grant execute on function public.get_data_export_cron_secret() to service_role;
