-- Service and RLS acceptance using synthetic members only; nothing is committed.
begin;
set local role service_role;
do $$
declare
  actor record; person uuid; result jsonb; replay jsonb; entry public.body_measurements;
  input jsonb; request uuid; tested integer:=0;
begin
  for actor in select distinct on (role_code) user_id,role_code from public.app_staff
    where enabled and deleted_at is null and user_id is not null and role_code in ('super_admin','admin') order by role_code,id loop
    tested:=tested+1;
    result:=public.gym_command(actor.user_id,gen_random_uuid(),'member.save',jsonb_build_object('full_name','Measurement rollback probe 20261028','category_id','guest'));
    person:=(result->>'member_id')::uuid;
    input:=jsonb_build_object('member_id',person,'measurement_month','2026-01-01','weight_kg',80,'fat_mass_kg',20,'skeletal_muscle_kg',32,'body_fat_percent',999);
    request:=gen_random_uuid();
    result:=public.gym_body_measurement(actor.user_id,request,'measurement.save',input);
    replay:=public.gym_body_measurement(actor.user_id,request,'measurement.save',input);
    assert replay=result, 'Retry changed result';
    select * into entry from public.body_measurements where id=(result->>'measurement_id')::uuid;
    assert entry.body_fat_percent=25, 'Percentage was not generated';
    begin
      perform public.gym_body_measurement(actor.user_id,gen_random_uuid(),'measurement.save',input);
      raise exception 'Duplicate accepted';
    exception when raise_exception then
      if sqlerrm not like 'This month already%' then raise; end if;
    end;
    input:=jsonb_build_object('member_id',person,'measurement_month','2026-01-01','measurement_unit','lb',
      'weight_lb','176.37','fat_mass_lb','44.09','skeletal_muscle_lb','70.55','id',entry.id,'expected_updated_at',entry.updated_at);
    perform public.gym_body_measurement(actor.user_id,gen_random_uuid(),'measurement.save',input);
    select * into entry from public.body_measurements where id=entry.id;
    assert entry.weight_kg=80 and entry.fat_mass_kg=20 and entry.skeletal_muscle_kg=32, 'Legacy values drifted';
    input:=input||jsonb_build_object('expected_updated_at',entry.updated_at,'weight_lb','180.01','fat_mass_lb','36','skeletal_muscle_lb','70');
    perform public.gym_body_measurement(actor.user_id,gen_random_uuid(),'measurement.save',input);
    begin
      perform public.gym_body_measurement(actor.user_id,gen_random_uuid(),'measurement.save',input);
      raise exception 'Stale edit accepted';
    exception when raise_exception then
      if sqlerrm not like 'Measurement changed%' then raise; end if;
    end;
    select * into entry from public.body_measurements where id=entry.id;
    assert entry.body_fat_percent=20, 'Edited percentage wrong';
    assert entry.weight_kg=81.6511625237 and round(entry.weight_kg/0.45359237,2)=180.01, 'Pounds precision lost';
    perform public.gym_body_measurement(actor.user_id,gen_random_uuid(),'measurement.delete',jsonb_build_object('member_id',person,'id',entry.id,'expected_updated_at',entry.updated_at));
    assert (select deleted_at is not null from public.body_measurements where id=entry.id), 'Delete was not retained';
    assert (select count(*)=4 from public.audit_events where entity_type='body_measurements' and entity_id=entry.id::text), 'Audit history incomplete';
    result:=public.gym_body_measurement(actor.user_id,gen_random_uuid(),'measurement.save',input-'id'-'expected_updated_at');
    perform set_config('measurement_probe.member_id',person::text,true);
    perform set_config('request.jwt.claim.sub',actor.user_id::text,true);
  end loop;
  assert tested=2, 'Both Admin and Staff must be tested';
end;
$$;
set local role authenticated;
do $$
begin
  assert (select count(*)=1 from public.body_measurements where member_id=current_setting('measurement_probe.member_id')::uuid), 'RLS did not hide deleted rows';
  assert not has_table_privilege(current_user,'public.body_measurements','INSERT,UPDATE,DELETE'), 'Browser write grant open';
  assert not has_function_privilege(current_user,'public.gym_body_measurement(uuid,uuid,text,jsonb)','EXECUTE'), 'Browser RPC grant open';
end;
$$;
rollback;
select (select count(*) from public.members where full_name='Measurement rollback probe 20261028') as retained_probe_members,
  (select count(*) from public.body_measurements) as measurement_rows,
  (select count(*) from public.audit_events where entity_type='body_measurements') as measurement_audits;
