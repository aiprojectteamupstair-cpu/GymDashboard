-- One-time Vercel owner provisioning. No browser grants or policy changes.
-- Credentials stay in Auth/Vercel, never in staff records or audit payloads.
create or replace function public.bootstrap_super_admin_staff(target_auth_id uuid, expected_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  identity auth.users%rowtype;
  owner public.app_staff%rowtype;
  owner_count integer;
  before_state jsonb;
begin
  if target_auth_id is null or expected_email is null or btrim(expected_email)='' then
    raise exception 'Invalid bootstrap identity' using errcode='22023';
  end if;
  select * into identity from auth.users where id=target_auth_id;
  if identity.id is null or identity.email is null or lower(identity.email)<>lower(btrim(expected_email))
    or identity.email_confirmed_at is null or identity.deleted_at is not null
    or identity.banned_until>now() then
    raise exception 'Confirmed active identity required' using errcode='42501';
  end if;
  -- Serialize across Vercel instances and ordinary staff provisioning/removal.
  lock table public.app_staff in share row exclusive mode;
  select count(*) into owner_count from public.app_staff where role_code='super_admin';
  if owner_count>1 then raise exception 'Owner configuration needs review' using errcode='42501'; end if;
  select * into owner from public.app_staff where role_code='super_admin';
  if owner.id is not null and owner.user_id=target_auth_id and owner.enabled and owner.deleted_at is null then
    return owner.id;
  end if;
  if exists(select 1 from public.app_staff where user_id=target_auth_id)
    or (owner.id is not null and (owner.user_id is not null or owner.deleted_at is not null)) then
    raise exception 'Existing staff cannot be reassigned or re-enabled by bootstrap' using errcode='42501';
  end if;
  if owner.id is null then
    insert into public.app_staff(user_id,display_name,role_code,enabled)
      values(target_auth_id,'Super Admin','super_admin',true) returning * into owner;
    before_state := null;
  else
    before_state := jsonb_build_object('user_id',owner.user_id,'enabled',owner.enabled);
    update public.app_staff set user_id=target_auth_id,enabled=true,updated_at=now()
      where id=owner.id returning * into owner;
  end if;
  insert into public.audit_events(actor_user_id,actor_name,entity_type,entity_id,action,changes,reason)
    values(owner.id,owner.display_name,'app_staff',owner.id::text,'staff.super_admin_bootstrapped',
      jsonb_build_object('before',before_state,'after',jsonb_build_object('user_id',target_auth_id,'role_code','super_admin','enabled',true)),
      'Initial owner provisioned through server-only Vercel configuration');
  return owner.id;
end $$;
revoke all on function public.bootstrap_super_admin_staff(uuid,text) from public,anon,authenticated;
grant execute on function public.bootstrap_super_admin_staff(uuid,text) to service_role;
