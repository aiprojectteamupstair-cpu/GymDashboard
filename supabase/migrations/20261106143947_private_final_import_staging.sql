-- Private, owner-only staging and recoverable before/after states for the
-- explicitly authorized final workbook reconciliation. No browser write path.
create schema if not exists tcf_import;
revoke all on schema tcf_import from public, anon, authenticated, service_role;
create table tcf_import.runs (
  id text primary key,
  manifest jsonb not null,
  state text not null default 'staging' check (state in ('staging','committed','restored')),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  result jsonb
);
create table tcf_import.rows (
  run_id text not null references tcf_import.runs(id),
  table_name text not null check (table_name in ('members','member_codes','memberships','training_purchases','attendance')),
  row_key text not null,
  operation text not null check (operation in ('insert','replace','archive')),
  before_row jsonb,
  after_row jsonb not null,
  primary key (run_id,table_name,row_key)
);
alter table tcf_import.runs enable row level security;
alter table tcf_import.rows enable row level security;
revoke all on all tables in schema tcf_import from public, anon, authenticated, service_role;
comment on schema tcf_import is 'Owner-only import staging and recoverable archive. Never expose through PostgREST.';
