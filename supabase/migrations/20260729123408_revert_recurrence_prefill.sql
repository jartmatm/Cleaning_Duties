create or replace function public.advance_duty_schedule(p_duty_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duty public.cleaning_duties%rowtype;
  v_rule jsonb;
  v_pattern text;
  v_next_start timestamptz;
  v_next_due timestamptz;
  v_shift_duration interval;
  v_day_offset integer;
  v_next_id uuid;
  v_final_status public.duty_status;
begin
  select *
  into v_duty
  from public.cleaning_duties
  where id = p_duty_id
  for update;

  if not found then
    return null;
  end if;

  if not (
    public.is_site_member(v_duty.site_id)
    or public.is_company_member((select company_id from public.sites where id = v_duty.site_id))
  ) then
    raise exception 'Not authorized to advance this duty';
  end if;

  if v_duty.starts_at is not null
    and v_duty.starts_at <= now()
    and (v_duty.due_date is null or v_duty.due_date > now())
    and v_duty.status::text = 'Scheduled' then
    update public.cleaning_duties
    set status = 'Pending', updated_at = now()
    where id = v_duty.id;
    return null;
  end if;

  if v_duty.due_date is null or v_duty.due_date > now() then
    return null;
  end if;

  if not v_duty.recurring then
    if v_duty.status::text in ('Draft', 'Scheduled', 'Pending', 'In Progress') then
      update public.cleaning_duties
      set status = case
        when v_duty.status::text = 'In Progress' then 'Incomplete'::public.duty_status
        else 'Missed'::public.duty_status
      end,
      updated_at = now()
      where id = v_duty.id;
    end if;
    return null;
  end if;

  if v_duty.status::text in ('Archived', 'Missed', 'Incomplete') then
    select id into v_next_id
    from public.cleaning_duties
    where previous_duty_id = v_duty.id;
    return v_next_id;
  end if;

  begin
    v_rule := coalesce(v_duty.recurring_rule::jsonb, '{"pattern":"daily","weekdays":[1]}'::jsonb);
  exception when others then
    v_rule := '{"pattern":"daily","weekdays":[1]}'::jsonb;
  end;
  v_pattern := coalesce(v_rule->>'pattern', 'daily');

  v_next_start := coalesce(v_duty.starts_at, v_duty.due_date);
  v_shift_duration := case
    when v_duty.starts_at is not null and v_duty.due_date is not null then v_duty.due_date - v_duty.starts_at
    else interval '0 seconds'
  end;

  loop
    if v_pattern = 'weekly' then
      select min(day_offset)
      into v_day_offset
      from generate_series(1, 7) as day_offset
      where exists (
        select 1
        from jsonb_array_elements_text(coalesce(v_rule->'weekdays', '[1]'::jsonb)) as weekday(value)
        where weekday.value::integer = extract(dow from v_next_start + day_offset * interval '1 day')::integer
      );
      v_next_start := v_next_start + coalesce(v_day_offset, 7) * interval '1 day';
    elsif v_pattern = 'monthly' then
      v_next_start := v_next_start + interval '1 month';
    elsif v_pattern = 'yearly' then
      v_next_start := v_next_start + interval '1 year';
    else
      v_next_start := v_next_start + interval '1 day';
    end if;

    v_next_due := case
      when v_duty.starts_at is not null then v_next_start + v_shift_duration
      else v_next_start
    end;

    exit when v_next_due > now();
  end loop;

  v_final_status := case
    when v_duty.status::text = 'Completed' then 'Archived'::public.duty_status
    when v_duty.status::text = 'In Progress' then 'Incomplete'::public.duty_status
    else 'Missed'::public.duty_status
  end;

  update public.cleaning_duties
  set status = v_final_status, updated_at = now()
  where id = v_duty.id;

  insert into public.cleaning_duties (
    site_id,
    created_by,
    title,
    description,
    priority,
    status,
    starts_at,
    due_date,
    recurring,
    recurring_rule,
    equipment,
    reference_photos,
    previous_duty_id
  ) values (
    v_duty.site_id,
    v_duty.created_by,
    v_duty.title,
    v_duty.description,
    v_duty.priority,
    'Scheduled',
    case when v_duty.starts_at is not null then v_next_start else null end,
    v_next_due,
    true,
    v_duty.recurring_rule,
    v_duty.equipment,
    v_duty.reference_photos,
    v_duty.id
  )
  on conflict (previous_duty_id) where previous_duty_id is not null do nothing
  returning id into v_next_id;

  if v_next_id is null then
    select id into v_next_id
    from public.cleaning_duties
    where previous_duty_id = v_duty.id;
    return v_next_id;
  end if;

  insert into public.duty_assignments (duty_id, profile_id, assigned_by)
  select v_next_id, profile_id, assigned_by
  from public.duty_assignments
  where duty_id = v_duty.id
  on conflict (duty_id, profile_id) do nothing;

  return v_next_id;
end;
$$;

revoke all on function public.advance_duty_schedule(uuid) from public;
grant execute on function public.advance_duty_schedule(uuid) to authenticated;

alter table public.sites
  drop column if exists time_zone;
