-- Run only on the approved workspace. Every fixture and audit is rolled back.
begin;
set local role service_role;
do $$
declare
  actor record; member_id uuid; result jsonb; visit public.attendance;
  profile public.members; payload jsonb; request uuid; tested integer := 0;
begin
  for actor in select distinct on (role_code) user_id,role_code from public.app_staff
    where enabled and deleted_at is null and user_id is not null
      and role_code in ('super_admin','admin') order by role_code,id loop
    tested := tested+1;
    result := public.gym_command(actor.user_id,gen_random_uuid(),'member.save',
      jsonb_build_object('full_name','Calendar UX verification fixture','category_id','guest','email','fixture@example.test'));
    member_id := (result->>'member_id')::uuid;
    select * into profile from public.members where id=member_id;
    if profile.email <> 'fixture@example.test' then raise exception 'Email create failed'; end if;
    perform public.gym_command(actor.user_id,gen_random_uuid(),'member.save',
      jsonb_build_object('id',member_id,'full_name',profile.full_name,'category_id','guest',
        'expected_updated_at',profile.updated_at,'email','edited@example.test'));
    select * into profile from public.members where id=member_id;
    if profile.email <> 'edited@example.test' then raise exception 'Email edit failed'; end if;
    begin
      perform public.gym_command(actor.user_id,gen_random_uuid(),'member.save',
        jsonb_build_object('full_name','Invalid email fixture','category_id','guest','email','bad'));
      raise exception 'Invalid email accepted';
    exception when others then
      if sqlerrm not like 'Enter a valid email%' then raise; end if;
    end;
    request := gen_random_uuid();
    payload := jsonb_build_object('member_id',member_id,'changes',jsonb_build_array(
      jsonb_build_object('date','2026-01-01','present',true,'expected',null)));
    perform public.gym_attendance_calendar(actor.user_id,request,payload);
    perform public.gym_attendance_calendar(actor.user_id,request,payload);
    select * into visit from public.attendance a where a.member_id=profile.id and a.attendance_date='2026-01-01';
    if visit.id is null or visit.checked_in_at is not null or visit.time_source <> 'manual_date_only'
      or visit.record_origin <> 'live' or visit.correction_reason not like '%automatic note%' then
      raise exception 'Date-only save failed';
    end if;
    payload := jsonb_build_object('member_id',member_id,'changes',jsonb_build_array(jsonb_build_object(
      'date','2026-01-01','present',false,'expected',jsonb_build_object('id',visit.id,
        'updated_at',visit.updated_at,'checked_in_at',visit.checked_in_at,'voided_at',visit.voided_at))));
    perform public.gym_attendance_calendar(actor.user_id,gen_random_uuid(),payload);
    begin
      perform public.gym_attendance_calendar(actor.user_id,gen_random_uuid(),payload);
      raise exception 'Stale request accepted';
    exception when others then
      if sqlerrm not like 'Attendance changed%' then raise; end if;
    end;
    select * into visit from public.attendance where id=visit.id;
    perform public.gym_attendance_calendar(actor.user_id,gen_random_uuid(),jsonb_build_object(
      'member_id',member_id,'changes',jsonb_build_array(jsonb_build_object('date','2026-01-01',
      'present',true,'expected',jsonb_build_object('id',visit.id,'updated_at',visit.updated_at,
        'checked_in_at',visit.checked_in_at,'voided_at',visit.voided_at)))));
    select * into visit from public.attendance where id=visit.id;
    if visit.voided_at is not null or visit.checked_in_at is not null then raise exception 'Restore changed unknown time'; end if;
  end loop;
  if tested=0 then raise exception 'No active staff available for verification'; end if;
  if has_function_privilege('anon','public.gym_attendance_calendar(uuid,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','public.gym_attendance_calendar(uuid,uuid,jsonb)','execute') then
    raise exception 'Calendar RPC must stay service-only';
  end if;
end $$;
rollback;
select count(*) as retained_test_profiles from public.members where full_name='Calendar UX verification fixture';
