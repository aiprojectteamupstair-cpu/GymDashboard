-- Remote ledger version 20261001105350.
grant update on public.app_staff to service_role;
create function public.disable_admin_account(actor_auth_id uuid, target_staff_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor public.app_staff; target public.app_staff;
begin
 select * into actor from public.app_staff where user_id=actor_auth_id and role_code='super_admin' and enabled and deleted_at is null;
 if actor.id is null then raise insufficient_privilege using message='Super Admin required'; end if;
 select * into target from public.app_staff where id=target_staff_id for update;
 if target.id is null or target.role_code<>'admin' or target.id=actor.id then raise exception 'Only another Admin account can be removed'; end if;
 if target.deleted_at is null then
  update public.app_staff set enabled=false,deleted_at=clock_timestamp(),updated_at=clock_timestamp() where id=target.id;
  insert into public.audit_events(actor_user_id,actor_name,entity_type,entity_id,action,reason)
  values(actor.id,actor.display_name,'app_staff',target.id::text,'staff.deleted','Super Admin confirmed account removal; history retained.');
 end if;
 return target.user_id;
end $$;
revoke all on function public.disable_admin_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.disable_admin_account(uuid,uuid) to service_role;
