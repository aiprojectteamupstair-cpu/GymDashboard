-- Run through Supabase SQL Editor or MCP execute_sql. All fixture writes roll back.
begin;
do $test$
declare
  person uuid := gen_random_uuid(); other_person uuid := gen_random_uuid();
  sub uuid := gen_random_uuid(); visit uuid := gen_random_uuid();
  original_snapshot jsonb;
begin
  insert into public.members(id,member_code,full_name,category_id)
    values(person,'C99999991','Foundation verification only','customer'),
          (other_person,'C99999992','Foundation verification only','customer');
  insert into public.member_codes(code,member_id,category_id)
    values('C99999991',person,'customer'),('C99999992',other_person,'customer');
  set constraints members_code_owner_fk immediate;

  begin
    insert into public.member_codes(code,member_id,category_id) values('C99999991',other_person,'customer');
    raise exception 'TEST FAILED: duplicate code accepted';
  exception when unique_violation then null; end;
  begin
    update public.members set member_code='C88888888' where id=person;
    raise exception 'TEST FAILED: unreserved code accepted';
  exception when foreign_key_violation then null; end;

  insert into public.memberships(id,member_id,transaction_kind,package_id,package_snapshot,
    plan_id,plan_snapshot,start_date,duration_months,calculated_end_date,member_code_snapshot,member_category_snapshot)
  values(sub,person,'New','gym','{"label":"Gym"}','plan-1','{"label":"1 month"}',
    '2028-01-31',1,'2028-02-29','C99999991','Customer');
  begin
    update public.memberships set calculated_end_date='2028-03-01' where id=sub;
    raise exception 'TEST FAILED: wrong calendar end accepted';
  exception when check_violation then null; end;
  begin
    update public.memberships set override_end_date='2028-03-02' where id=sub;
    raise exception 'TEST FAILED: override without reason/actor accepted';
  exception when check_violation then null; end;
  if ('2026-01-31'::date+make_interval(months=>3))::date <> '2026-04-30'::date then
    raise exception 'TEST FAILED: target-month clipping'; end if;
  select package_snapshot into original_snapshot from public.memberships where id=sub;
  update public.packages set label='Gym verification only' where id='gym';
  if (select package_snapshot from public.memberships where id=sub) <> original_snapshot then
    raise exception 'TEST FAILED: historical snapshot changed'; end if;

  insert into public.attendance(id,member_id,attendance_date,checked_in_at,recorded_at,
    updated_at,member_code_snapshot,member_category_snapshot)
  values(visit,person,'2026-01-01','2025-12-31T17:30:00Z','2025-12-31T18:00:00Z',
    '2025-12-31T18:00:00Z','C99999991','Customer');
  begin
    insert into public.attendance(member_id,attendance_date,checked_in_at,recorded_at,
      member_code_snapshot,member_category_snapshot)
    values(person,'2026-01-01','2025-12-31T17:30:00Z','2025-12-31T18:00:00Z','C99999991','Customer');
    raise exception 'TEST FAILED: duplicate attendance accepted';
  exception when unique_violation then null; end;
  begin
    update public.attendance set checked_in_at='2025-12-31T17:29:59Z' where id=visit;
    raise exception 'TEST FAILED: Myanmar date mismatch accepted';
  exception when check_violation then null; end;
  begin
    update public.attendance set member_id=other_person,membership_id=sub where id=visit;
    raise exception 'TEST FAILED: another member membership accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.attendance set checked_in_at='2025-12-31T19:00:00Z' where id=visit;
    raise exception 'TEST FAILED: future time beyond record/update time accepted';
  exception when check_violation then null; end;

  insert into public.attendance(member_id,attendance_date,record_origin,time_source,source_reference)
    values(person,'2025-12-01','import','import_date_only','{"batch":"verification-only","sheet":"test","row":1}');
  if (select checked_in_at from public.attendance where member_id=person and attendance_date='2025-12-01') is not null then
    raise exception 'TEST FAILED: date-only import invented a time'; end if;
  insert into public.memberships(member_id,record_origin,source_reference,source_end_date)
    values(person,'import','{"batch":"verification-only"}','2025-12-20');
  if not exists(select 1 from public.memberships where member_id=person and record_origin='import'
    and effective_end_date='2025-12-20' and calculated_end_date is null and start_date is null) then
    raise exception 'TEST FAILED: legacy dates not preserved'; end if;
  begin
    insert into public.training_purchases(member_id,membership_id,sessions,duration_months,start_date,end_date)
      values(person,sub,20,1,'2028-01-31','2028-02-29');
    raise exception 'TEST FAILED: wrong PT validity accepted';
  exception when check_violation then null; end;
  begin
    delete from public.members where id=person;
    raise exception 'TEST FAILED: member history deleted';
  exception when foreign_key_violation then null; end;
end $test$;
rollback;
select 'PASS: integrity checks; all test rows and catalogue edits rolled back' as result;
