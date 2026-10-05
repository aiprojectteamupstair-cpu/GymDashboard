-- Remote ledger version: 20261005084758. Created through the CLI, aligned after deployment.
-- Backdated live visits retain their actual recording time and an attributed reason.
alter table public.attendance drop constraint attendance_check2;
alter table public.attendance add constraint attendance_check2 check (
  record_origin <> 'live' or (
    time_source in ('current','manual') and member_code_snapshot is not null and member_category_snapshot is not null
    and (attendance_date = (recorded_at at time zone 'Asia/Rangoon')::date
      or (time_source = 'manual' and attendance_date < (recorded_at at time zone 'Asia/Rangoon')::date
        and length(btrim(coalesce(correction_reason,''))) > 0 and updated_by is not null))
  )
);

create function public.gym_attendance_calendar(actor_auth_id uuid, request_id uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor public.app_staff; person public.members; visit public.attendance; audit public.audit_events;
  change jsonb; expected jsonb; day_value date; seen date[] := '{}'; reason_value text;
  stamp timestamptz; time_value timestamptz; before_rows jsonb := '[]'; after_rows jsonb := '[]'; output jsonb;
begin
  if actor_auth_id is null or request_id is null or jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'Invalid calendar request';
  end if;
  -- Share the normal command lock so check-ins, stale edits and retries remain atomic.
  perform pg_advisory_xact_lock(7152026);
  select * into actor from public.app_staff where user_id=actor_auth_id and enabled and deleted_at is null for update;
  if actor.id is null or actor.role_code <> 'super_admin' then
    raise insufficient_privilege using message='Only Admin can edit the attendance calendar';
  end if;
  select * into audit from public.audit_events where id=request_id;
  if found then
    if audit.actor_user_id is distinct from actor.id or audit.action <> 'attendance.calendar'
      or audit.changes->'request' is distinct from payload then raise exception 'Request ID already used for a different operation'; end if;
    return audit.changes->'result';
  end if;
  stamp := clock_timestamp();
  reason_value := btrim(payload->>'reason');
  if coalesce(length(reason_value),0) not between 1 and 500 then raise exception 'Enter a correction reason of 1-500 characters'; end if;
  if jsonb_typeof(payload->'changes') is distinct from 'array' then raise exception 'Choose attendance dates'; end if;
  if jsonb_array_length(payload->'changes') not between 1 and 32 then raise exception 'Choose 1-32 attendance dates'; end if;
  select * into person from public.members where id=(payload->>'member_id')::uuid for update;
  if person.id is null then raise exception 'Member not found'; end if;
  for change in select value from jsonb_array_elements(payload->'changes') loop
    if coalesce(change->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Choose a past Myanmar calendar date'; end if;
    day_value := (change->>'date')::date;
    if day_value >= (stamp at time zone 'Asia/Rangoon')::date then raise exception 'Choose a past Myanmar calendar date'; end if;
    if day_value = any(seen) then raise exception 'Each date may only appear once'; end if;
    seen := array_append(seen,day_value);
    if jsonb_typeof(change->'present') is distinct from 'boolean' then raise exception 'Choose a valid attendance status'; end if;
    select * into visit from public.attendance where member_id=person.id and attendance_date=day_value for update;
    expected := change->'expected';
    if not (change ? 'expected') or (visit.id is null and expected is distinct from 'null'::jsonb)
      or (visit.id is not null and (jsonb_typeof(expected) is distinct from 'object'
        or not (expected ?& array['id','updated_at','checked_in_at','voided_at'])
        or (expected->>'id')::uuid is distinct from visit.id
        or (expected->>'updated_at')::timestamptz is distinct from visit.updated_at
        or (expected->>'checked_in_at')::timestamptz is distinct from visit.checked_in_at
        or (expected->>'voided_at')::timestamptz is distinct from visit.voided_at)) then
      raise exception 'Attendance changed. Refresh and reopen the calendar';
    end if;
    before_rows := before_rows || jsonb_build_array(case when visit.id is null then null else to_jsonb(visit) end);
    if not (change->>'present')::boolean then
      if visit.id is null or visit.voided_at is not null then raise exception 'No recorded visit to remove'; end if;
      update public.attendance set voided_at=stamp,void_reason=reason_value,updated_at=stamp,updated_by=actor.id,correction_reason=reason_value
        where id=visit.id returning * into visit;
    else
      if change ? 'time' and coalesce(change->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Enter a valid check-in time'; end if;
      if visit.id is null and not (change ? 'time') then raise exception 'Enter a check-in time for each new visit'; end if;
      time_value := case when change ? 'time' then (day_value::text || 'T' || (change->>'time') || ':00+06:30')::timestamptz else visit.checked_in_at end;
      if visit.id is null then
        insert into public.attendance(member_id,attendance_date,checked_in_at,recorded_at,time_source,checked_in_by,updated_by,updated_at,correction_reason,member_code_snapshot,member_category_snapshot)
          values(person.id,day_value,time_value,stamp,'manual',actor.id,actor.id,stamp,reason_value,person.member_code,
            (select label from public.member_categories where id=person.category_id)) returning * into visit;
      else
        update public.attendance set checked_in_at=time_value,
          original_checked_in_at=case when time_value is distinct from visit.checked_in_at then coalesce(visit.original_checked_in_at,visit.checked_in_at) else visit.original_checked_in_at end,
          time_source=case when change ? 'time' then 'manual' else visit.time_source end,
          voided_at=null,void_reason=null,updated_at=stamp,updated_by=actor.id,correction_reason=reason_value
          where id=visit.id returning * into visit;
      end if;
    end if;
    after_rows := after_rows || jsonb_build_array(to_jsonb(visit));
  end loop;
  output := jsonb_build_object('member_id',person.id,'count',cardinality(seen));
  insert into public.audit_events(id,actor_user_id,actor_name,entity_type,entity_id,action,changes,reason)
    values(request_id,actor.id,actor.display_name,'members',person.id::text,'attendance.calendar',
      jsonb_build_object('before',before_rows,'after',after_rows,'request',payload,'result',output),reason_value);
  return output;
end;
$$;
revoke all on function public.gym_attendance_calendar(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.gym_attendance_calendar(uuid,uuid,jsonb) to service_role;
