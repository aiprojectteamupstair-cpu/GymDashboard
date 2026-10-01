import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
if (plan.report.issues.length) throw new Error('Unresolved identity mappings');
const payload = JSON.stringify(plan).replaceAll("'", "''");
const sql = `begin;
set local statement_timeout='60s';
lock table public.attendance,public.members,public.member_codes in share row exclusive mode;
create temporary table attendance_expected on commit drop as
select (r->>'member_id')::uuid member_id,r->>'code' source_code,r->>'category' category,
 make_date(2026,(r->>'month')::int,d::int) attendance_date,r as source_row
from jsonb_array_elements('${payload}'::jsonb->'records') r
cross join lateral jsonb_array_elements_text(r->'days') d;
do $$
begin
 if exists(select 1 from attendance_expected e left join public.member_codes c on c.code=e.source_code and c.member_id=e.member_id where c.code is null) then raise exception 'Live member mapping changed'; end if;
 if exists(select 1 from attendance_expected group by member_id,attendance_date having count(*)>1) then raise exception 'Duplicate import keys'; end if;
 if exists(select 1 from attendance_expected e join public.attendance a using(member_id,attendance_date) where a.source_reference->>'batch' is distinct from '${plan.report.batch}') then raise exception 'Existing attendance conflict; review before importing'; end if;
end $$;
insert into public.attendance(member_id,attendance_date,checked_in_at,time_source,member_code_snapshot,member_category_snapshot,record_origin,source_reference)
select e.member_id,e.attendance_date,(e.attendance_date+time '18:00') at time zone 'Asia/Rangoon','import_assumed',e.source_code,e.category,'import',
 jsonb_build_object('batch','${plan.report.batch}','file','${plan.report.file}','sha256','${plan.report.sha256}',
 'sheet',e.source_row->>'sheet','row',e.source_row->'row','day',extract(day from e.attendance_date),
 'time_assumed',true,'assumed_local_time','18:00','original_time',null,'time_note','User-authorized placeholder; source records presence only. Exclude from arrival-hour analysis.',
 'identity_resolution',case when e.source_row->>'resolved_note'='true' then 'User confirmed C123 duplicate removed; unassigned dates attributed to C124' else 'Member code and source master row/name verified' end)
from attendance_expected e on conflict(member_id,attendance_date) do nothing;
do $$
begin
 if (select count(*) from public.attendance where source_reference->>'batch'='${plan.report.batch}')<>${plan.report.total}
 or exists(select 1 from attendance_expected e left join public.attendance a using(member_id,attendance_date)
 where a.id is null or a.time_source<>'import_assumed' or a.member_code_snapshot<>e.source_code or a.member_category_snapshot<>e.category or a.voided_at is not null
 or a.checked_in_at<>((e.attendance_date+time '18:00') at time zone 'Asia/Rangoon')) then raise exception 'Attendance reconciliation failed'; end if;
end $$;
insert into public.audit_events(actor_name,entity_type,entity_id,action,changes,reason)
select 'Authorized workbook import','import_batch','${plan.report.batch}','attendance_import.completed',
jsonb_build_object('sha256','${plan.report.sha256}','total',${plan.report.total},'first_date','${plan.report.first_date}','last_date','${plan.report.last_date}','assumed_time','18:00 Asia/Rangoon'),
'User requested July–September presence import. Unknown source times explicitly assumed; blank cells not imported.'
where not exists(select 1 from public.audit_events where action='attendance_import.completed' and entity_id='${plan.report.batch}');
select to_char(attendance_date,'YYYY-MM') as month,count(*) as visits from public.attendance where source_reference->>'batch'='${plan.report.batch}' group by 1 order by 1;
`;
fs.writeFileSync(path.join(dir, 'dry-run.sql'), sql + 'rollback;');
fs.writeFileSync(path.join(dir, 'import.sql'), sql + 'commit;');
console.log(JSON.stringify({bytes:sql.length,visits:plan.report.total}));
