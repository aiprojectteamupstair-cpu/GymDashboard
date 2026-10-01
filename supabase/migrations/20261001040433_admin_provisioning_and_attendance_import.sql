-- Imported times are explicit placeholders, never observed arrival times.
alter table public.attendance drop constraint attendance_time_source_check;
alter table public.attendance add constraint attendance_time_source_check
  check (time_source in ('current','manual','import_exact','import_date_only','import_assumed'));
alter table public.attendance add constraint attendance_assumed_time_check
  check (time_source <> 'import_assumed' or (record_origin='import' and source_reference->>'time_assumed'='true'));

-- Only the trusted Edge Function's server credential can provision staff.
-- No browser write grants, no member-data write grants, no SECURITY DEFINER.
grant select, insert on public.app_staff to service_role;
grant insert on public.audit_events to service_role;
create or replace function public.provision_admin_staff(actor_auth_id uuid, target_auth_id uuid, staff_name text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor public.app_staff%rowtype; result uuid;
begin
  select * into actor from public.app_staff
    where user_id=actor_auth_id and enabled and deleted_at is null and role_code='super_admin';
  if actor.id is null then raise exception 'Super Admin access required' using errcode='42501'; end if;
  if target_auth_id=actor_auth_id or char_length(btrim(staff_name)) not between 1 and 120 then
    raise exception 'Invalid staff request' using errcode='22023';
  end if;
  insert into public.app_staff(user_id,display_name,role_code,enabled)
    values(target_auth_id,btrim(staff_name),'admin',true) returning id into result;
  insert into public.audit_events(actor_user_id,actor_name,entity_type,entity_id,action,changes,reason)
    values(actor.id,actor.display_name,'app_staff',result::text,'staff.admin_created',
      jsonb_build_object('user_id',target_auth_id,'role_code','admin','enabled',true),'Super Admin created an Admin through the trusted API');
  return result;
end $$;
revoke all on function public.provision_admin_staff(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.provision_admin_staff(uuid,uuid,text) to service_role;
