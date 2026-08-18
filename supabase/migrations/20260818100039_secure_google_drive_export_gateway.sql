create or replace function public.store_data_export_anon_key(p_anon_key text)
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

revoke all on function public.store_data_export_anon_key(text)
  from public, anon, authenticated;
grant execute on function public.store_data_export_anon_key(text) to service_role;

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
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cleaning_duties_data_export_anon_key'
        ),
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cleaning_duties_data_export_anon_key'
        )
      ),
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
