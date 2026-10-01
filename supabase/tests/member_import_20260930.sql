-- Read-only, source-batch reconciliation. No member names/contact details returned.
-- Run against the selected project; later live records outside this batch are ignored.
with batch_members as (
  select * from public.members
  where source_reference->>'batch' = 'members-4c90166233196635'
), batch_memberships as (
  select * from public.memberships
  where source_reference->>'batch' = 'members-4c90166233196635'
), batch_pt as (
  select * from public.training_purchases
  where source_reference->>'batch' = 'members-4c90166233196635'
), remark_records as (
  select r from batch_members m
  cross join lateral jsonb_array_elements(m.source_reference->'remark_only_records') r
), source_rows as (
  select (source_reference->>'row')::integer as row_no from batch_memberships
  union all select (source_reference->>'row')::integer from batch_pt
  union all select (r->>'_row')::integer from remark_records
)
select
  (select count(*) from batch_members) = 424 as member_count_ok,
  (select count(*) from batch_memberships) = 485 as membership_count_ok,
  (select count(*) from batch_pt) = 22 as pt_count_ok,
  (select count(*) from remark_records) = 84 as remarks_count_ok,
  (select count(*) = 591 and count(distinct row_no) = 591
    and min(row_no) = 2 and max(row_no) = 592 from source_rows) as source_coverage_ok,
  (select count(*) = 1 from public.audit_events
    where action = 'member_import.completed' and entity_id = 'members-4c90166233196635') as one_completed_batch,
  (select bool_and(source_reference->>'sha256' =
    '4c901662331966352abf3b260817c6c93a60dd5fe41b9d906db95a90939a0495')
    from batch_members) as source_hash_ok,
  (select bool_and(member_code ~ '^G[0-9]{3,}$')
    from batch_members where category_id = 'guest') as guest_padding_ok,
  (select count(*) = 70 from public.member_codes c join batch_members m on m.id = c.member_id
    where c.retired_at is not null) as former_codes_preserved;
