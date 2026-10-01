-- Run inside BEGIN / ROLLBACK. Synthetic records never persist.
set local role service_role;
do $$
declare actor_id uuid; result jsonb; retry jsonb; person_id uuid; request_key uuid:=gen_random_uuid(); stamp timestamptz; payload jsonb;
begin
 select user_id into actor_id from public.app_staff where enabled and deleted_at is null and role_code='super_admin' limit 1;
 if actor_id is null then raise exception 'Test requires an existing enabled Super Admin'; end if;
 begin
  perform public.gym_command(gen_random_uuid(),gen_random_uuid(),'member.save','{}');
  raise exception 'Unauthorized command unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 payload:=jsonb_build_object('full_name','SYNTHETIC ROLLBACK TEST','category_id','guest');
 result:=public.gym_command(actor_id,request_key,'member.save',payload);
 retry:=public.gym_command(actor_id,request_key,'member.save',payload);
 if result<>retry then raise exception 'Idempotency failed'; end if;
 person_id:=(result->>'member_id')::uuid;
 if not exists(select 1 from public.member_codes where member_id=person_id and code ~ '^G[0-9]{3,}$') then raise exception 'Guest code allocation failed'; end if;
 result:=public.gym_command(actor_id,gen_random_uuid(),'attendance.checkin',jsonb_build_object('id',person_id,'acknowledged',true));
 retry:=public.gym_command(actor_id,gen_random_uuid(),'attendance.checkin',jsonb_build_object('id',person_id,'acknowledged',true));
 if retry->>'duplicate'<>'true' or retry->>'attendance_id'<>result->>'attendance_id' then raise exception 'Duplicate presence test failed'; end if;
 select updated_at into stamp from public.members where id=person_id;
 result:=public.gym_command(actor_id,gen_random_uuid(),'member.save',jsonb_build_object('id',person_id,'expected_updated_at',stamp,'full_name','SYNTHETIC ROLLBACK TEST','category_id','customer','membership',jsonb_build_object('package_id','gym','plan_id','plan-1','start_date','2026-01-31','training_type','pt','training_sessions',10)));
 if not exists(select 1 from public.memberships where member_id=person_id and calculated_end_date='2026-02-28') then raise exception 'Calendar end test failed'; end if;
 if not exists(select 1 from public.training_purchases where member_id=person_id and end_date='2026-02-28') then raise exception 'PT test failed'; end if;
 if (select count(*) from public.member_codes where member_id=person_id)<>2 then raise exception 'Former ID test failed'; end if;
 begin
  perform public.gym_command(actor_id,gen_random_uuid(),'member.save',jsonb_build_object('id',person_id,'expected_updated_at',stamp,'full_name','STALE','category_id','customer'));
  raise exception 'Stale edit unexpectedly succeeded';
 exception when raise_exception then if sqlerrm<>'Member changed. Refresh before editing.' then raise; end if; end;
end $$;
reset role;
select 'live command rollback tests passed' as result;
