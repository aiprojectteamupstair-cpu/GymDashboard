begin;
set local role service_role;
do $$
declare
  actor record;
  profile public.members;
  result jsonb;
  request uuid;
  payload jsonb;
  old_code text;
  tested integer := 0;
begin
  for actor in select distinct on (role_code) user_id, role_code from public.app_staff
    where enabled and deleted_at is null and user_id is not null and role_code in ('super_admin','admin')
    order by role_code, id loop
    tested := tested + 1;
    request := gen_random_uuid();
    payload := jsonb_build_object('category_id','guest', 'guest_type','student', 'full_name','Guest type verification fixture');
    result := public.gym_command(actor.user_id,request,'member.save',payload);
    if public.gym_command(actor.user_id,request,'member.save',payload) is distinct from result then raise exception 'Retry failed'; end if;
    select * into strict profile from public.members where id=(result->>'member_id')::uuid;
    old_code := profile.member_code;
    if profile.guest_type is distinct from 'student' or profile.category_id <> 'guest' then raise exception 'Guest create failed'; end if;
    payload := (payload - 'guest_type') || jsonb_build_object('id',profile.id,'expected_updated_at',profile.updated_at);
    perform public.gym_command(actor.user_id,gen_random_uuid(),'member.save',payload);
    select * into strict profile from public.members where id=profile.id;
    if profile.guest_type is distinct from 'student' then raise exception 'Older caller lost guest type'; end if;
    payload := payload || jsonb_build_object('expected_updated_at',profile.updated_at,'guest_type','external');
    request := gen_random_uuid();
    perform public.gym_command(actor.user_id,request,'member.save',payload);
    if not exists (select 1 from public.audit_events where id=request and changes#>>'{before,guest_type}'='student'
      and changes#>>'{after,guest_type}'='external') then raise exception 'Missing guest type audit'; end if;
    begin
      perform public.gym_command(actor.user_id,gen_random_uuid(),'member.save',payload || '{"expected_updated_at":"2000-01-01"}'::jsonb);
      raise exception 'Accepted stale edit';
    exception when raise_exception then if sqlerrm not like 'Member changed%' then raise; end if; end;
    begin
      perform public.gym_command(actor.user_id,gen_random_uuid(),'member.save',
        jsonb_build_object('full_name','Guest type verification fixture','category_id','customer','guest_type','student'));
      raise exception 'Accepted type on non-Guest';
    exception when raise_exception then if sqlerrm not like 'Choose a valid guest type%' then raise; end if; end;
    select * into strict profile from public.members where id=profile.id;
    perform public.gym_command(actor.user_id,gen_random_uuid(),'member.save',
      jsonb_build_object('id',profile.id,'full_name',profile.full_name,'category_id','student','expected_updated_at',profile.updated_at,
        'membership',jsonb_build_object('package_id','gym','plan_id','plan-1','start_date','2026-01-15')));
    select * into strict profile from public.members where id=profile.id;
    if profile.guest_type is not null or profile.category_id <> 'student' or not exists (
      select 1 from public.member_codes where member_id=profile.id and code=old_code and retired_at is not null
    ) then raise exception 'Guest conversion failed'; end if;
  end loop;
  if tested=0 then raise exception 'No active staff available'; end if;
  if has_function_privilege('anon','public.gym_command(uuid,uuid,text,jsonb)','execute')
    or has_function_privilege('authenticated','public.gym_command(uuid,uuid,text,jsonb)','execute') then
    raise exception 'Command must stay service-only';
  end if;
end $$;
rollback;
