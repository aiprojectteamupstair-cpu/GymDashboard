-- Remote ledger version: 20261001104539. Only the authenticated Edge handler supplies actor_auth_id.
grant select, insert, update on public.members, public.member_codes, public.memberships,
  public.training_purchases, public.attendance, public.packages, public.discounts to service_role;
grant select on public.member_categories, public.membership_plans, public.audit_events to service_role;

create function public.gym_command(actor_auth_id uuid, request_id uuid, command text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor public.app_staff; person public.members; previous jsonb; output jsonb;
  cat public.member_categories; pack public.packages; plan public.membership_plans; discount public.discounts;
  visit public.attendance; subscription public.memberships; audit public.audit_events;
  target uuid; code_value text; next_number bigint; subscription_input jsonb;
  stamp timestamptz := clock_timestamp(); day_value date := (clock_timestamp() at time zone 'Asia/Rangoon')::date;
  time_value timestamptz; start_value date; override_value date; session_count int; months_count int;
  entity text; entity_key text; table_name text; new_id text; before_time timestamptz;
begin
  if actor_auth_id is null or request_id is null or payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Invalid command request';
  end if;
  select * into actor from public.app_staff where user_id=actor_auth_id and enabled and deleted_at is null;
  if actor.id is null then raise insufficient_privilege using message='Enabled staff access required'; end if;
  -- Short database-only transaction. Serializes code allocation, stale checks and retries.
  perform pg_advisory_xact_lock(7152026);
  select * into audit from public.audit_events where id=request_id;
  if found then
    if audit.actor_user_id <> actor.id or audit.action <> command or audit.changes->'request' <> payload then
      raise exception 'Request ID already used for a different operation';
    end if;
    return audit.changes->'result';
  end if;
  if command in ('member.save','member.archive','membership.add','attendance.checkin') then
    target := nullif(payload->>'id','')::uuid;
    if command='membership.add' then target := (payload->>'member_id')::uuid; end if;
    if target is not null then
      select * into person from public.members where id=target for update;
      if person.id is null then raise exception 'Member not found. Refresh and try again.'; end if;
      previous := to_jsonb(person);
    elsif command <> 'member.save' then raise exception 'Member ID is required'; end if;
  end if;

  if command='member.save' then
    if length(btrim(coalesce(payload->>'full_name',''))) not between 1 and 120 then raise exception 'Enter a name of 1–120 characters'; end if;
    select * into cat from public.member_categories where id=payload->>'category_id' and enabled;
    if cat.id is null then raise exception 'Choose an active member category'; end if;
    if person.id is not null and (payload->>'expected_updated_at')::timestamptz is distinct from person.updated_at then raise exception 'Member changed. Refresh before editing.'; end if;
    if person.id is not null and person.category_id <> 'guest' and cat.id='guest' then raise exception 'A member cannot be converted back to Guest'; end if;
    subscription_input := nullif(payload->'membership','null'::jsonb);
    if cat.id='guest' and subscription_input is not null then raise exception 'Guest does not require membership'; end if;
    if person.category_id='guest' and cat.id<>'guest' and subscription_input is null then raise exception 'Guest conversion requires membership'; end if;
    if target is null or cat.id <> person.category_id then
      select coalesce(max(substring(code from '[0-9]+$')::bigint),0)+1 into next_number from public.member_codes where category_id=cat.id;
      code_value := cat.prefix || lpad(next_number::text,greatest(cat.digits,length(next_number::text)), '0');
    else code_value := person.member_code; end if;
    if target is null then
      target := gen_random_uuid();
      insert into public.members(id,member_code,full_name,category_id,contact_phone,date_of_birth,student_id,remark,created_by,updated_by)
      values(target,code_value,btrim(payload->>'full_name'),cat.id,nullif(btrim(payload->>'contact_phone'),''),nullif(payload->>'date_of_birth','')::date,
        nullif(payload->>'student_id',''),coalesce(payload->>'remark',''),actor.id,actor.id);
      insert into public.member_codes(code,member_id,category_id) values(code_value,target,cat.id);
    else
      if code_value<>person.member_code then
        update public.member_codes set retired_at=stamp where code=person.member_code;
        insert into public.member_codes(code,member_id,category_id) values(code_value,target,cat.id);
      end if;
      update public.members set member_code=code_value,full_name=btrim(payload->>'full_name'),category_id=cat.id,
        contact_phone=nullif(btrim(payload->>'contact_phone'),''),date_of_birth=nullif(payload->>'date_of_birth','')::date,
        student_id=case when cat.id='student' then nullif(payload->>'student_id','') else student_id end,
        remark=coalesce(payload->>'remark',''),updated_at=stamp,updated_by=actor.id where id=target;
    end if;
    if subscription_input is not null then
      perform public.gym_command(actor_auth_id,gen_random_uuid(),'membership.add',subscription_input || jsonb_build_object('member_id',target));
    end if;
    entity:='members'; entity_key:=target::text; output:=jsonb_build_object('member_id',target);

  elsif command='member.archive' then
    if (payload->>'expected_updated_at')::timestamptz is distinct from person.updated_at then raise exception 'Member changed. Refresh before editing.'; end if;
    update public.members set archived_at=case when (payload->>'archive')::boolean then stamp else null end,updated_at=stamp,updated_by=actor.id where id=target;
    entity:='members';entity_key:=target::text;output:=jsonb_build_object('member_id',target);

  elsif command='membership.add' then
    if person.archived_at is not null or person.category_id='guest' then raise exception 'Choose a non-archived member, not a Guest'; end if;
    select * into pack from public.packages where id=payload->>'package_id' and enabled;
    select * into plan from public.membership_plans where id=payload->>'plan_id' and enabled;
    if pack.id is null or plan.id is null then raise exception 'Choose an active package and plan'; end if;
    if nullif(payload->>'discount_id','') is not null then
      select * into discount from public.discounts where id=payload->>'discount_id' and enabled;
      if discount.id is null then raise exception 'Choose an active discount'; end if;
    end if;
    start_value:=nullif(payload->>'start_date','')::date;
    override_value:=nullif(payload->>'override_end_date','')::date;
    if start_value is null then raise exception 'Start date is required'; end if;
    insert into public.memberships(member_id,transaction_kind,package_id,package_snapshot,plan_id,plan_snapshot,discount_id,discount_snapshot,
      member_code_snapshot,member_category_snapshot,start_date,duration_months,calculated_end_date,override_end_date,override_reason,overridden_by,overridden_at,voucher_reference,remark,created_by)
    values(target,case when exists(select 1 from public.memberships where member_id=target and voided_at is null) then 'Renew' else 'New' end,
      pack.id,to_jsonb(pack),plan.id,to_jsonb(plan),discount.id,case when discount.id is not null then to_jsonb(discount) end,
      person.member_code,(select label from public.member_categories where id=person.category_id),start_value,plan.duration_months,
      (start_value+make_interval(months=>plan.duration_months))::date,override_value,nullif(btrim(payload->>'override_reason'),''),
      case when override_value is not null then actor.id end,case when override_value is not null then stamp end,
      nullif(btrim(payload->>'voucher_reference'),''),coalesce(payload->>'remark',''),actor.id) returning * into subscription;
    if coalesce(payload->>'training_type','none')<>'none' then
      session_count:=(payload->>'training_sessions')::int;
      months_count:=case session_count when 5 then 1 when 10 then 1 when 20 then 2 when 50 then 5 end;
      if not pack.allows_training or payload->>'training_type'<>'pt' or months_count is null then raise exception 'Choose valid PT sessions for Gym'; end if;
      insert into public.training_purchases(member_id,membership_id,sessions,duration_months,start_date,end_date,created_by)
      values(target,subscription.id,session_count,months_count,start_value,(start_value+make_interval(months=>months_count))::date,actor.id);
    end if;
    entity:='memberships';entity_key:=subscription.id::text;output:=jsonb_build_object('member_id',target,'membership_id',subscription.id);

  elsif command='attendance.checkin' then
    if person.archived_at is not null then raise exception 'Member is archived'; end if;
    select * into visit from public.attendance where member_id=target and attendance_date=day_value;
    if visit.id is not null then
      if visit.voided_at is not null then raise exception 'Today has a voided attendance. Review before re-entry.'; end if;
      return jsonb_build_object('attendance_id',visit.id,'duplicate',true);
    end if;
    if person.category_id='guest' and exists(select 1 from public.attendance where member_id=target and voided_at is null) then raise exception 'Guest trial already used. Convert to membership first.'; end if;
    if coalesce((payload->>'acknowledged')::boolean,false) is not true then raise exception 'Confirm member identity and entry eligibility'; end if;
    if nullif(payload->>'time','') is not null then
      if payload->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid time'; end if;
      time_value := (day_value+(payload->>'time')::time) at time zone 'Asia/Rangoon';
    else time_value:=stamp; end if;
    if time_value>stamp then raise exception 'Check-in time cannot be in the future'; end if;
    insert into public.attendance(member_id,attendance_date,checked_in_at,recorded_at,updated_at,time_source,checked_in_by,member_code_snapshot,member_category_snapshot)
    values(target,day_value,time_value,stamp,stamp,case when nullif(payload->>'time','') is null then 'current' else 'manual' end,actor.id,person.member_code,
      (select label from public.member_categories where id=person.category_id)) returning * into visit;
    entity:='attendance';entity_key:=visit.id::text;output:=jsonb_build_object('attendance_id',visit.id,'duplicate',false);

  elsif command='attendance.time' then
    select * into visit from public.attendance where id=(payload->>'id')::uuid and voided_at is null for update;
    if visit.id is null then raise exception 'Attendance not found'; end if;
    if (payload->>'expected_updated_at')::timestamptz is distinct from visit.updated_at then raise exception 'Attendance changed. Refresh before editing.'; end if;
    if length(btrim(coalesce(payload->>'reason',''))) not between 1 and 500 then raise exception 'A correction reason is required'; end if;
    if coalesce(payload->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid time'; end if;
    time_value := (visit.attendance_date+(payload->>'time')::time) at time zone 'Asia/Rangoon';
    if time_value>stamp then raise exception 'Check-in time cannot be in the future'; end if;
    before_time:=visit.checked_in_at;
    previous:=jsonb_build_object('checked_in_at',before_time);
    update public.attendance set checked_in_at=time_value,original_checked_in_at=coalesce(original_checked_in_at,checked_in_at),
      time_source='manual',correction_reason=btrim(payload->>'reason'),updated_at=stamp,updated_by=actor.id where id=visit.id;
    entity:='attendance';entity_key:=visit.id::text;output:=jsonb_build_object('attendance_id',visit.id,'checked_in_at',time_value);

  elsif command in ('catalogue.save','catalogue.status') then
    table_name:=payload->>'kind';new_id:=nullif(payload->>'id','');
    if table_name not in ('packages','discounts') or table_name is null then raise exception 'Unknown catalogue'; end if;
    if new_id is not null then
      execute format('select to_jsonb(t) from public.%I t where id=$1 for update',table_name) into previous using new_id;
      if previous is null then raise exception 'Catalogue item not found'; end if;
      if (payload->>'expected_updated_at')::timestamptz is distinct from (previous->>'updated_at')::timestamptz then raise exception 'Catalogue changed. Refresh before editing.'; end if;
      if command='catalogue.save' and actor.role_code<>'super_admin' then raise insufficient_privilege using message='Super Admin required for editing'; end if;
    end if;
    if command='catalogue.status' then
      if new_id is null then raise exception 'Catalogue ID required'; end if;
      execute format('update public.%I set enabled=$1,updated_at=$2 where id=$3',table_name) using (payload->>'enabled')::boolean,stamp,new_id;
    else
      if length(btrim(coalesce(payload->>'label',''))) not between 1 and 100 then raise exception 'Enter a catalogue name'; end if;
      if new_id is null then new_id:=gen_random_uuid()::text;
        if table_name='packages' then
          insert into public.packages(id,label,access_notes,allows_training,enabled) values(new_id,btrim(payload->>'label'),coalesce(payload->>'access_notes',''),coalesce((payload->>'allows_training')::boolean,false),coalesce((payload->>'enabled')::boolean,true));
        else insert into public.discounts(id,label,percentage,enabled) values(new_id,btrim(payload->>'label'),(payload->>'percentage')::numeric,coalesce((payload->>'enabled')::boolean,true)); end if;
      elsif table_name='packages' then
        update public.packages set label=btrim(payload->>'label'),access_notes=coalesce(payload->>'access_notes',''),allows_training=coalesce((payload->>'allows_training')::boolean,false),enabled=(payload->>'enabled')::boolean,updated_at=stamp where id=new_id and not legacy;
        if not found then raise exception 'Historical packages cannot be edited'; end if;
      else update public.discounts set label=btrim(payload->>'label'),percentage=(payload->>'percentage')::numeric,enabled=(payload->>'enabled')::boolean,updated_at=stamp where id=new_id; end if;
    end if;
    entity:=table_name;entity_key:=new_id;output:=jsonb_build_object('id',new_id);
  else raise exception 'Unsupported command'; end if;
  insert into public.audit_events(id,actor_user_id,actor_name,entity_type,entity_id,action,changes,reason)
  values(request_id,actor.id,actor.display_name,entity,entity_key,command,
    jsonb_build_object('request',payload,'result',output,'before',previous,'after',output),payload->>'reason');
  return output;
end $$;
revoke all on function public.gym_command(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.gym_command(uuid,uuid,text,jsonb) to service_role;
