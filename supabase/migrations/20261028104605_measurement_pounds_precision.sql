-- Keep canonical kg values and old clients; exact two-decimal lb inputs need ten kg decimals.
alter table public.body_measurements drop column body_fat_percent;
alter table public.body_measurements
  alter column weight_kg type numeric(14,10),
  alter column fat_mass_kg type numeric(14,10),
  alter column skeletal_muscle_kg type numeric(14,10);
alter table public.body_measurements add column body_fat_percent numeric(5,2)
  generated always as (round(fat_mass_kg/nullif(weight_kg,0)*100,2)) stored;

create or replace function public.gym_body_measurement(actor_auth_id uuid, request_id uuid, command text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor public.app_staff; person public.members; entry public.body_measurements; audit public.audit_events;
  previous jsonb; output jsonb; target uuid; month_value date; key text; unit text; keys text[];
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
    unit:=coalesce(payload->>'measurement_unit','kg');
    if unit not in ('kg','lb') then raise exception 'Choose a supported measurement unit'; end if;
    if (unit='lb' and payload ?| array['weight_kg','fat_mass_kg','skeletal_muscle_kg'])
      or (unit='kg' and payload ?| array['weight_lb','fat_mass_lb','skeletal_muscle_lb']) then
      raise exception 'Use one measurement unit per entry';
    end if;
    keys:=case when unit='lb' then array['weight_lb','fat_mass_lb','skeletal_muscle_lb'] else array['weight_kg','fat_mass_kg','skeletal_muscle_kg'] end;
    foreach key in array keys loop
      if coalesce(jsonb_typeof(payload->key),'null') not in ('number','string')
        or btrim(payload->>key) !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Enter measurements in % with up to two decimal places',unit; end if;
    end loop;
    weight_value := (payload->>keys[1])::numeric;
    fat_value := (payload->>keys[2])::numeric;
    muscle_value := (payload->>keys[3])::numeric;
    if unit='lb' then
      if weight_value>2204.62 or fat_value>weight_value or muscle_value>weight_value then raise exception 'Enter valid measurements; fat mass and skeletal muscle cannot exceed weight'; end if;
      -- Preserve untouched displayed values so legacy records do not drift on edit.
      weight_value:=case when entry.id is not null and round(entry.weight_kg/0.45359237,2)=weight_value then entry.weight_kg else weight_value*0.45359237 end;
      fat_value:=case when entry.id is not null and round(entry.fat_mass_kg/0.45359237,2)=fat_value then entry.fat_mass_kg else fat_value*0.45359237 end;
      muscle_value:=case when entry.id is not null and round(entry.skeletal_muscle_kg/0.45359237,2)=muscle_value then entry.skeletal_muscle_kg else muscle_value*0.45359237 end;
    end if;
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
