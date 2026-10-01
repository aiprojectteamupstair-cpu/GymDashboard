-- No persistent changes. Positive enabled-staff tests follow Auth bootstrap.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
do $test$
begin
  if exists(select 1 from public.packages) or exists(select 1 from public.member_categories)
    or exists(select 1 from public.app_staff) then
    raise exception 'TEST FAILED: non-staff account can read business records'; end if;
  begin
    insert into public.packages(id,label) values('verification-denied','Must never persist');
    raise exception 'TEST FAILED: authenticated write accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.app_staff(display_name,role_code,enabled) values('Must never persist','super_admin',true);
    raise exception 'TEST FAILED: self-promotion accepted';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
set local role anon;
do $test$
begin
  begin
    perform 1 from public.members limit 1;
    raise exception 'TEST FAILED: anonymous member access accepted';
  exception when insufficient_privilege then null; end;
end $test$;
rollback;
select 'PASS: unaffiliated read denied, anonymous access denied, writes and role self-promotion denied' as result;
