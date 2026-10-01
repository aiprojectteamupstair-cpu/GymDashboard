-- Phase 1: schema + confirmed reference catalogues only. No people, visits or accounts.
-- Filename aligned to the version returned by the remote migration ledger.
-- Target verified with Supabase plugin: axbfwmrrxsgzevvqshdu.
-- Application writes intentionally remain closed until trusted transactional APIs exist.

create table public.member_categories (
  id text primary key,
  code text not null unique,
  label text not null check (btrim(label) <> ''),
  prefix text unique,
  digits smallint check (digits between 1 and 8),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.packages (
  id text primary key default gen_random_uuid()::text,
  code text unique,
  label text not null check (btrim(label) <> ''),
  access_notes text not null default '',
  allows_training boolean not null default false,
  enabled boolean not null default true,
  legacy boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not legacy or not enabled)
);
create unique index packages_label_ci on public.packages (lower(btrim(label)));

create table public.membership_plans (
  id text primary key default gen_random_uuid()::text,
  label text not null check (btrim(label) <> ''),
  duration_months smallint not null check (duration_months in (1,3,6,12)),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discounts (
  id text primary key default gen_random_uuid()::text,
  label text not null check (btrim(label) <> ''),
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index discounts_label_ci on public.discounts (lower(btrim(label)));

create table public.payment_methods (
  id text primary key default gen_random_uuid()::text,
  code text unique,
  label text not null check (btrim(label) <> ''),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payment_methods_label_ci on public.payment_methods (lower(btrim(label)));

-- Operator profiles, NOT gym Staff/Employee members. Passwords live only in Auth.
-- Stable staff id preserves audit identity if an Auth account is removed later.
create table public.app_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (btrim(display_name) <> ''),
  role_code text not null check (role_code in ('super_admin','admin')),
  enabled boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deleted_at is null or not enabled)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique check (member_code ~ '^(VC|C|S|E|G)[0-9]+$'),
  full_name text not null check (btrim(full_name) <> ''),
  category_id text not null references public.member_categories(id) on delete restrict,
  contact_phone text,
  date_of_birth date,
  student_id text,
  remark text not null default '',
  archived_at timestamptz,
  record_origin text not null default 'live' check (record_origin in ('live','import')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_staff(id) on delete restrict,
  updated_by uuid references public.app_staff(id) on delete restrict,
  check (date_of_birth is null or date_of_birth <= (created_at at time zone 'Asia/Rangoon')::date),
  check (record_origin <> 'import' or source_reference <> '{}'::jsonb)
);

-- Normalized replacement for local previous_codes; reserves current + former codes.
-- Both inserts occur in one transaction; old reservations must not be removed.
create table public.member_codes (
  code text primary key check (code ~ '^(VC|C|S|E|G)[0-9]+$'),
  member_id uuid not null references public.members(id) on delete restrict,
  category_id text not null references public.member_categories(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (code, member_id)
);
alter table public.members add constraint members_code_owner_fk
  foreign key (member_code, id) references public.member_codes(code, member_id)
  deferrable initially deferred;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  transaction_kind text check (transaction_kind in ('New','Renew')),
  package_id text references public.packages(id) on delete restrict,
  package_snapshot jsonb check (jsonb_typeof(package_snapshot) = 'object'),
  plan_id text references public.membership_plans(id) on delete restrict,
  plan_snapshot jsonb check (jsonb_typeof(plan_snapshot) = 'object'),
  discount_id text references public.discounts(id) on delete restrict,
  discount_snapshot jsonb check (jsonb_typeof(discount_snapshot) = 'object'),
  member_code_snapshot text,
  member_category_snapshot text,
  start_date date,
  duration_months smallint check (duration_months in (1,3,6,12)),
  calculated_end_date date,
  source_end_date date,
  override_end_date date,
  override_reason text,
  overridden_by uuid references public.app_staff(id) on delete restrict,
  overridden_at timestamptz,
  effective_end_date date generated always as (coalesce(override_end_date, source_end_date, calculated_end_date)) stored,
  payment_method_id text references public.payment_methods(id) on delete restrict,
  payment_method_label_snapshot text,
  voucher_reference text,
  remark text not null default '',
  record_origin text not null default 'live' check (record_origin in ('live','import')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_staff(id) on delete restrict,
  updated_by uuid references public.app_staff(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  unique (id, member_id),
  check (record_origin <> 'import' or source_reference <> '{}'::jsonb),
  check (record_origin <> 'live' or (
    package_id is not null and package_snapshot is not null and plan_id is not null
    and plan_snapshot is not null and start_date is not null and duration_months is not null
    and calculated_end_date is not null and transaction_kind is not null
    and member_code_snapshot is not null and member_category_snapshot is not null
    and calculated_end_date = (start_date + make_interval(months => duration_months::integer))::date
    and source_end_date is null
  )),
  check (override_end_date is null or (
    start_date is not null and override_end_date >= start_date
    and nullif(btrim(override_reason),'') is not null and overridden_at is not null and overridden_by is not null
  )),
  check (record_origin <> 'live' or calculated_end_date >= start_date),
  check (voided_at is null or nullif(btrim(void_reason),'') is not null)
);

create table public.training_purchases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  membership_id uuid,
  service_type text not null default 'pt' check (service_type = 'pt'),
  sessions smallint check (sessions in (5,10,20,50)),
  duration_months smallint,
  start_date date,
  end_date date,
  remark text not null default '',
  record_origin text not null default 'live' check (record_origin in ('live','import')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.app_staff(id) on delete restrict,
  updated_by uuid references public.app_staff(id) on delete restrict,
  voided_at timestamptz,
  void_reason text,
  foreign key (membership_id, member_id) references public.memberships(id, member_id) on delete restrict,
  check (record_origin <> 'import' or source_reference <> '{}'::jsonb),
  check (record_origin <> 'live' or (membership_id is not null and sessions is not null
    and start_date is not null and end_date is not null and duration_months is not null
    and duration_months = case sessions when 5 then 1 when 10 then 1 when 20 then 2 when 50 then 5 end
    and end_date = (start_date + make_interval(months => duration_months::integer))::date)),
  check (voided_at is null or nullif(btrim(void_reason),'') is not null)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  membership_id uuid,
  attendance_date date not null,
  checked_in_at timestamptz,
  original_checked_in_at timestamptz,
  recorded_at timestamptz not null default now(),
  time_source text not null default 'current' check (time_source in ('current','manual','import_exact','import_date_only')),
  member_code_snapshot text,
  member_category_snapshot text,
  checked_in_by uuid references public.app_staff(id) on delete restrict,
  updated_by uuid references public.app_staff(id) on delete restrict,
  correction_reason text,
  updated_at timestamptz not null default now(),
  record_origin text not null default 'live' check (record_origin in ('live','import')),
  source_reference jsonb not null default '{}'::jsonb check (jsonb_typeof(source_reference) = 'object'),
  voided_at timestamptz,
  void_reason text,
  unique (member_id, attendance_date),
  foreign key (membership_id, member_id) references public.memberships(id, member_id) on delete restrict,
  check (record_origin <> 'import' or source_reference <> '{}'::jsonb),
  check ((checked_in_at is null and record_origin = 'import' and time_source = 'import_date_only')
    or (checked_in_at is not null and time_source <> 'import_date_only'
      and (checked_in_at at time zone 'Asia/Rangoon')::date = attendance_date
      and checked_in_at <= greatest(recorded_at,updated_at))),
  check (record_origin <> 'live' or (time_source in ('current','manual')
    and attendance_date = (recorded_at at time zone 'Asia/Rangoon')::date
    and member_code_snapshot is not null and member_category_snapshot is not null)),
  check (original_checked_in_at is null or (
    (original_checked_in_at at time zone 'Asia/Rangoon')::date = attendance_date
    and nullif(btrim(correction_reason),'') is not null)),
  check (voided_at is null or nullif(btrim(void_reason),'') is not null)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_staff(id) on delete restrict,
  actor_name text,
  entity_type text not null,
  entity_id text not null,
  action text not null check (btrim(action) <> ''),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  reason text,
  occurred_at timestamptz not null default now()
);

-- FK indexes including operator references; no member-history cascade deletes.
do $indexes$
declare r record; cols text;
begin
  for r in select c.conname, c.conrelid, c.conkey from pg_constraint c
    join pg_namespace n on n.oid=c.connamespace
    where c.contype='f' and n.nspname='public'
  loop
    if not exists (select 1 from pg_index i where i.indrelid=r.conrelid
      and (i.indkey::smallint[])[0:cardinality(r.conkey)-1] @> r.conkey) then
      select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
      from unnest(r.conkey) with ordinality k(attnum,ord)
      join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.attnum;
      execute format('create index %I on %s (%s)', left(r.conname,55)||'_idx',r.conrelid::regclass,cols);
    end if;
  end loop;
end $indexes$;
create index memberships_member_start_idx on public.memberships(member_id,start_date desc);
create index memberships_created_at_idx on public.memberships(created_at desc) where voided_at is null;
create index memberships_expiry_idx on public.memberships(effective_end_date) where voided_at is null;
create index attendance_date_member_idx on public.attendance(attendance_date,member_id) where voided_at is null;
create index audit_events_entity_idx on public.audit_events(entity_type,entity_id,occurred_at desc);

-- RLS on every table. No anonymous access, no browser write/role self-promotion.
-- Enabled staff may read business data. Operators can read only their own role row.
alter table public.app_staff enable row level security;
revoke all on public.app_staff from public, anon, authenticated, service_role;
grant select on public.app_staff to authenticated;
create policy staff_read_own_enabled_profile on public.app_staff for select to authenticated
  using (user_id=(select auth.uid()) and enabled and deleted_at is null);

do $policies$
declare t text;
begin
  foreach t in array array['member_categories','packages','membership_plans','discounts','payment_methods',
    'members','member_codes','memberships','training_purchases','attendance','audit_events']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy staff_read on public.%I for select to authenticated using (
      (select exists(select 1 from public.app_staff s where s.user_id=(select auth.uid())
        and s.enabled and s.deleted_at is null and s.role_code in (''super_admin'',''admin''))))',t);
  end loop;
end $policies$;

-- Only user-confirmed non-personal reference values. Payment choices remain unconfirmed.
insert into public.member_categories(id,code,label,prefix,digits) values
 ('vip','vip','VIP Customer','VC',2),('customer','customer','Customer','C',3),
 ('student','student','Student','S',3),('staff','staff','Staff/Employee','E',3),
 ('guest','guest','Guest','G',2);
insert into public.packages(id,code,label,access_notes,allows_training) values
 ('gym','gym','Gym','All Classes, Swimming Pool, Sauna',true),
 ('pool','pool','Swimming Pool Only','Swimming Pool',false);
insert into public.membership_plans(id,label,duration_months) values
 ('plan-1','1 month',1),('plan-3','3 months',3),('plan-6','6 months',6),('plan-12','1 Year',12);
insert into public.discounts(id,label,percentage) values
 ('condo-50','Condo 50%',50),('student-20','Student 20%',20),('student-50','Student 50%',50);

comment on table public.app_staff is 'Enabled operator roles bound to Supabase Auth, not gym member categories. No local password hashes.';
comment on table public.member_codes is 'Permanent current/former readable IDs. Do not delete or reassign on category conversion.';
comment on column public.members.source_reference is 'Reviewed import batch/file/sheet/row provenance; no automatic name or voucher merges.';
comment on column public.memberships.source_end_date is 'Historical recorded expiry, preserved without recalculation.';
comment on column public.attendance.checked_in_at is 'Nullable only for reviewed date-only imports; never invent a historical arrival time.';
comment on table public.audit_events is 'Append-only through future trusted write APIs. No client insert/update/delete grants.';
