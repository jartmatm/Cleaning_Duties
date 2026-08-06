create table public.unplanned_duty_requests (
  id uuid constraint unplanned_duty_requests_pkey primary key default gen_random_uuid(),
  company_id uuid not null constraint unplanned_duty_requests_company_id_fkey references public.companies(id) on delete cascade,
  site_id uuid not null constraint unplanned_duty_requests_site_id_fkey references public.sites(id) on delete cascade,
  cleaner_id uuid not null constraint unplanned_duty_requests_cleaner_id_fkey references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  location text not null,
  shift_started_at timestamptz not null,
  shift_ends_at timestamptz not null,
  reported_completed_at timestamptz not null default now(),
  before_photos text[] not null default '{}'::text[],
  after_photos text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint unplanned_duty_requests_title_length check (char_length(btrim(title)) between 2 and 120),
  constraint unplanned_duty_requests_description_length check (char_length(btrim(description)) between 2 and 2000),
  constraint unplanned_duty_requests_location_length check (char_length(btrim(location)) between 2 and 240),
  constraint unplanned_duty_requests_shift_window check (shift_ends_at > shift_started_at),
  constraint unplanned_duty_requests_reported_in_shift check (
    reported_completed_at >= shift_started_at
    and reported_completed_at <= shift_ends_at
  )
);

create index unplanned_duty_requests_site_created_idx
  on public.unplanned_duty_requests (site_id, created_at desc);

create index unplanned_duty_requests_cleaner_created_idx
  on public.unplanned_duty_requests (cleaner_id, created_at desc);

alter table public.unplanned_duty_requests enable row level security;

create or replace function public.can_submit_unplanned_duty(
  target_company_id uuid,
  target_site_id uuid,
  target_cleaner_id uuid,
  target_shift_started_at timestamptz,
  target_shift_ends_at timestamptz,
  target_reported_completed_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_cleaner_id = (select auth.uid())
    and target_shift_started_at <= now()
    and target_shift_ends_at > now()
    and target_reported_completed_at between now() - interval '15 minutes' and now() + interval '1 minute'
    and exists (
      select 1
      from public.profiles cleaner
      join public.sites site on site.id = target_site_id
      join public.site_members membership
        on membership.site_id = site.id
       and membership.profile_id = cleaner.id
      where cleaner.id = target_cleaner_id
        and cleaner.role = 'Cleaner'
        and cleaner.company_id = target_company_id
        and site.company_id = target_company_id
    )
    and exists (
      select 1
      from public.cleaning_duties duty
      join public.duty_assignments assignment on assignment.duty_id = duty.id
      where assignment.profile_id = target_cleaner_id
        and duty.site_id = target_site_id
        and duty.starts_at = target_shift_started_at
        and duty.due_date = target_shift_ends_at
        and duty.status::text in ('Scheduled', 'Pending', 'In Progress', 'Completed')
    );
$$;

revoke all on function public.can_submit_unplanned_duty(uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.can_submit_unplanned_duty(uuid, uuid, uuid, timestamptz, timestamptz, timestamptz) to authenticated, service_role;

create policy "unplanned duties visible by request access"
on public.unplanned_duty_requests
for select
to authenticated
using (
  cleaner_id = (select auth.uid())
  or (select public.can_manage_site(site_id))
);

create policy "cleaners can submit unplanned duties in active shifts"
on public.unplanned_duty_requests
for insert
to authenticated
with check (
  (select public.can_submit_unplanned_duty(
    company_id,
    site_id,
    cleaner_id,
    shift_started_at,
    shift_ends_at,
    reported_completed_at
  ))
);

revoke all on public.unplanned_duty_requests from anon;
revoke update, delete on public.unplanned_duty_requests from authenticated;
grant select, insert on public.unplanned_duty_requests to authenticated;
grant all on public.unplanned_duty_requests to service_role;

create or replace function public.review_unplanned_duty_request(
  p_request_id uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.unplanned_duty_requests%rowtype;
  v_reviewer_id uuid := (select auth.uid());
  v_duty_id uuid;
  v_storage_bucket text;
begin
  if v_reviewer_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_approve is null then
    raise exception 'A review decision is required';
  end if;

  select request.*
  into v_request
  from public.unplanned_duty_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'This request was already reviewed' using errcode = 'P0002';
  end if;

  if not public.can_manage_site(v_request.site_id) then
    raise exception 'You are not allowed to review this request';
  end if;

  select site.storage_bucket
  into v_storage_bucket
  from public.sites site
  where site.id = v_request.site_id;

  if p_approve then
    insert into public.cleaning_duties (
      site_id,
      created_by,
      title,
      description,
      priority,
      status,
      starts_at,
      due_date,
      completed_at,
      recurring,
      equipment,
      reference_photos,
      completion_photos,
      before_photos,
      after_photos,
      created_at,
      updated_at
    )
    values (
      v_request.site_id,
      v_reviewer_id,
      btrim(v_request.title),
      'Location: ' || btrim(v_request.location) || E'\n\n' || btrim(v_request.description),
      'Medium',
      'Completed',
      v_request.shift_started_at,
      v_request.shift_ends_at,
      v_request.reported_completed_at,
      false,
      '{}'::text[],
      '{}'::text[],
      '{}'::text[],
      v_request.before_photos,
      v_request.after_photos,
      v_request.reported_completed_at,
      now()
    )
    returning id into v_duty_id;

    insert into public.duty_assignments (
      duty_id,
      profile_id,
      assigned_by,
      assigned_at,
      completed_at
    )
    values (
      v_duty_id,
      v_request.cleaner_id,
      v_reviewer_id,
      v_request.reported_completed_at,
      v_request.reported_completed_at
    );

    insert into public.activity_logs (
      company_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    )
    values (
      v_request.company_id,
      v_reviewer_id,
      'cleaning_duty',
      v_duty_id,
      'approved_unplanned_duty',
      jsonb_build_object(
        'cleaner_id', v_request.cleaner_id,
        'request_id', v_request.id,
        'reported_completed_at', v_request.reported_completed_at
      )
    );
  else
    insert into public.activity_logs (
      company_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    )
    values (
      v_request.company_id,
      v_reviewer_id,
      'unplanned_duty_request',
      v_request.id,
      'rejected_unplanned_duty',
      jsonb_build_object(
        'cleaner_id', v_request.cleaner_id,
        'site_id', v_request.site_id,
        'reported_completed_at', v_request.reported_completed_at
      )
    );
  end if;

  delete from public.unplanned_duty_requests
  where id = v_request.id;

  return jsonb_build_object(
    'approved', p_approve,
    'duty_id', v_duty_id,
    'storage_bucket', v_storage_bucket,
    'before_photos', to_jsonb(v_request.before_photos),
    'after_photos', to_jsonb(v_request.after_photos)
  );
end;
$$;

revoke all on function public.review_unplanned_duty_request(uuid, boolean) from public;
grant execute on function public.review_unplanned_duty_request(uuid, boolean) to authenticated, service_role;

drop policy if exists "site managers can delete site storage objects" on storage.objects;
create policy "site managers and unplanned uploaders can delete site storage objects"
on storage.objects
for delete
to authenticated
using (
  exists (
    select 1
    from public.sites site
    where site.storage_bucket = storage.objects.bucket_id
      and (storage.foldername(storage.objects.name))[1] = site.id::text
      and (
        (select public.can_manage_site(site.id))
        or (
          (storage.foldername(storage.objects.name))[2] = 'unplanned'
          and (storage.foldername(storage.objects.name))[3] = (select auth.uid())::text
          and (select public.is_site_member(site.id))
        )
      )
  )
);
