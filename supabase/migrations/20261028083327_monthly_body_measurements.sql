create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  measurement_month date not null,
  weight_kg numeric(6,2) not null check (weight_kg>0 and weight_kg<=1000),
  fat_mass_kg numeric(6,2) not null check (fat_mass_kg>=0 and fat_mass_kg<=weight_kg),
  skeletal_muscle_kg numeric(6,2) not null check (skeletal_muscle_kg>=0 and skeletal_muscle_kg<=weight_kg),
  body_fat_percent numeric(5,2) generated always as (round(fat_mass_kg/nullif(weight_kg,0)*100,2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.app_staff(id),
  updated_by uuid not null references public.app_staff(id),
  deleted_at timestamptz,
  check (extract(day from measurement_month)=1),
  check (measurement_month<=date_trunc('month',created_at at time zone 'Asia/Rangoon')::date)
);
create unique index body_measurements_member_month on public.body_measurements(member_id,measurement_month) where deleted_at is null;
create index body_measurements_created_by on public.body_measurements(created_by);
create index body_measurements_updated_by on public.body_measurements(updated_by);
alter table public.body_measurements enable row level security;
revoke all on public.body_measurements from public,anon,authenticated,service_role;
grant select on public.body_measurements to authenticated;
grant select,insert,update on public.body_measurements to service_role;
create policy staff_read on public.body_measurements for select to authenticated using (
  deleted_at is null and (select exists(select 1 from public.app_staff s
    where s.user_id=(select auth.uid()) and s.enabled and s.deleted_at is null
      and s.role_code in ('super_admin','admin')))
);

create function public.gym_body_measurement(actor_auth_id uuid, request_id uuid, command text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor public.app_staff; person public.members; entry public.body_measurements; audit public.audit_events;
  previous jsonb; output jsonb; target uuid; month_value date; key text;
  weight_value numeric; fat_value numeric; muscle_value numeric; stamp timestamptz;
begin
  if actor_auth_id is null or request_id is null or jsonb_typeof(payload) is distinct from 'object'
    or command is null or command not in ('measurement.save','measurement.delete') then raise exception 'Invalid measurement request'; end if;
  perform pg_advisory_xact_lock(7152026);
  select * into actor from public.app_staff where user_id=actor_auth_id and enabled and deleted_at is null for update;
  if actor.id is null or actor.role_code not in ('super_admin','admin') then
    raise insufficient_privilege using message='An authorized Admin or Staff account is required';
  end if;
  select * into audit from public.audit_events where id=request_id;
  if found then
    if audit.actor_user_id is distinct from actor.id or audit.action is distinct from command
      or audit.changes->'request' is distinct from payload then raise exception 'Request ID already used for a different operation'; end if;
    return audit.changes->'result';
  end if;
  stamp := clock_timestamp();
  select * into person from public.members where id=(payload->>'member_id')::uuid for update;
  if person.id is null then raise exception 'Member not found'; end if;
  target := nullif(payload->>'id','')::uuid;
  if target is not null then
    select * into entry from public.body_measurements where id=target and member_id=person.id and deleted_at is null for update;
    if entry.id is null or (payload->>'expected_updated_at')::timestamptz is distinct from entry.updated_at then
      raise exception 'Measurement changed. Refresh and reopen it before editing';
    end if;
    previous := to_jsonb(entry);
    stamp := greatest(stamp,entry.updated_at+interval '1 microsecond');
  end if;
  if command='measurement.delete' then
    if entry.id is null then raise exception 'Measurement not found'; end if;
    update public.body_measurements set deleted_at=stamp,updated_at=stamp,updated_by=actor.id where id=target returning * into entry;
  else
    if person.archived_at is not null then raise exception 'Restore the member before adding or editing measurements'; end if;
    if coalesce(payload->>'measurement_month','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' then raise exception 'Choose a valid measurement month'; end if;
    month_value := (payload->>'measurement_month')::date;
    if month_value>date_trunc('month',stamp at time zone 'Asia/Rangoon')::date then raise exception 'Measurement month cannot be in the future'; end if;
    if entry.id is not null and entry.measurement_month<>month_value then raise exception 'An existing measurement must keep its original month'; end if;
    foreach key in array array['weight_kg','fat_mass_kg','skeletal_muscle_kg'] loop
      if coalesce(jsonb_typeof(payload->key),'null') not in ('number','string')
        or btrim(payload->>key) !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Enter measurements in kg with up to two decimal places'; end if;
    end loop;
    weight_value := (payload->>'weight_kg')::numeric;
    fat_value := (payload->>'fat_mass_kg')::numeric;
    muscle_value := (payload->>'skeletal_muscle_kg')::numeric;
    if weight_value<=0 or weight_value>1000 or fat_value<0 or muscle_value<0
      or fat_value>weight_value or muscle_value>weight_value then raise exception 'Enter valid measurements; fat mass and skeletal muscle cannot exceed weight'; end if;
    if exists(select 1 from public.body_measurements b where b.member_id=person.id and b.measurement_month=month_value
      and b.deleted_at is null and b.id is distinct from target) then raise exception 'This month already has measurements. Refresh and edit that entry'; end if;
    if entry.id is null then
      insert into public.body_measurements(member_id,measurement_month,weight_kg,fat_mass_kg,skeletal_muscle_kg,created_at,updated_at,created_by,updated_by)
        values(person.id,month_value,weight_value,fat_value,muscle_value,stamp,stamp,actor.id,actor.id) returning * into entry;
    else
      update public.body_measurements set weight_kg=weight_value,fat_mass_kg=fat_value,skeletal_muscle_kg=muscle_value,
        updated_at=stamp,updated_by=actor.id where id=target returning * into entry;
    end if;
  end if;
  output := jsonb_build_object('member_id',person.id,'measurement_id',entry.id);
  insert into public.audit_events(id,actor_user_id,actor_name,entity_type,entity_id,action,changes,reason)
    values(request_id,actor.id,actor.display_name,'body_measurements',entry.id::text,command,
      jsonb_build_object('before',previous,'after',to_jsonb(entry),'request',payload,'result',output),
      case when command='measurement.delete' then 'Monthly body measurement deleted' else 'Monthly body measurement saved' end);
  return output;
end;
$$;
revoke all on function public.gym_body_measurement(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.gym_body_measurement(uuid,uuid,text,jsonb) to service_role;
