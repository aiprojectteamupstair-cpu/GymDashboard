import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { prepareMemberImport } from './member-import-mapping.mjs';

const [source,python,mode] = process.argv.slice(2);
if(!source||!python||!['start-date','recorded-only'].includes(mode))throw new Error('Usage: node scripts/prepare-member-import.mjs <xlsx> <bundled-python> <start-date|recorded-only>');
const bytes=fs.readFileSync(source),sha256=createHash('sha256').update(bytes).digest('hex');
const extraction = spawnSync(python,['-c',`import openpyxl,json,datetime,sys
w=openpyxl.load_workbook(sys.argv[1],data_only=True)
f=openpyxl.load_workbook(sys.argv[1],data_only=False)
assert not any(c.data_type=='f' for s in f for row in s for c in row), 'Formula source requires explicit review'
print(json.dumps({s.title:[dict(zip([str(c.value) for c in s[1]],row),_row=i) for i,row in enumerate(s.iter_rows(min_row=2,values_only=True),2) if any(x is not None for x in row)] for s in w},default=lambda x:x.isoformat() if isinstance(x,(datetime.datetime,datetime.date)) else str(x),ensure_ascii=True))`,source],{encoding:'utf8',maxBuffer:5*1024*1024});
if(extraction.status!==0)throw new Error(extraction.stderr || extraction.error?.message || 'Workbook reader failed');
const plan=prepareMemberImport(JSON.parse(extraction.stdout),{file:path.basename(source),sha256,recordedDateIsStart:mode==='start-date'});
const dir=path.resolve('.private-imports',plan.batch);fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify(plan,null,2));
fs.writeFileSync(path.join(dir,'review.json'),JSON.stringify(plan.report,null,2));
const backup=path.join(dir,path.basename(source));if(!fs.existsSync(backup))fs.copyFileSync(source,backup);
const payload=JSON.stringify({...plan,outcomes:undefined,report:{counts:plan.report.counts,categoryCounts:plan.report.categoryCounts,recordedDateIsStart:plan.report.recordedDateIsStart}}).replaceAll("'","''");
let delimiter='$member_import_'+sha256.slice(0,16)+'$';
while(payload.includes(delimiter)) delimiter=delimiter.slice(0,-1)+'x$';
const sql=`begin;
set local standard_conforming_strings = on;
set local statement_timeout = '60s';
lock table public.members,public.member_codes,public.memberships,public.training_purchases,public.attendance,public.audit_events in share row exclusive mode;
do ${delimiter}
declare p jsonb := '${payload}'::jsonb; m jsonb; r jsonb; a text; person uuid; pack jsonb; plan_snapshot jsonb; discount_snapshot jsonb; counts jsonb;
begin
  if exists(select 1 from public.audit_events where action='member_import.completed' and entity_id=p->>'batch') then
    if (select count(*) from public.members where source_reference->>'batch'=p->>'batch')<>(p->'report'->'counts'->>'members')::int then raise exception 'Existing batch count mismatch'; end if;
    return;
  end if;
  if exists(select 1 from public.members) or exists(select 1 from public.memberships) or exists(select 1 from public.training_purchases) or exists(select 1 from public.attendance) then raise exception 'Target contains business records; stop for reconciliation'; end if;
  if (select count(*) from public.packages)<>2 or not exists(select 1 from public.packages where id='gym' and label='Gym') or not exists(select 1 from public.packages where id='pool' and label='Swimming Pool Only') then raise exception 'Unexpected package catalogue'; end if;
  update public.member_categories set digits=3,updated_at=now() where id='guest';
  for m in select value from jsonb_array_elements(p->'members') loop
    insert into public.members(member_code,full_name,category_id,contact_phone,student_id,remark,record_origin,source_reference)
    values(m->>'member_code',m->>'full_name',m->>'category_id',m->>'contact_phone',m->>'student_id',m->>'remark','import',m->'source_reference') returning id into person;
    insert into public.member_codes(code,member_id,category_id) values(m->>'member_code',person,m->>'category_id');
    for a in select jsonb_array_elements_text(m->'aliases') loop
      insert into public.member_codes(code,member_id,category_id,retired_at) values(a,person,m->>'category_id',now());
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(p->'memberships') loop
    select id into strict person from public.members where member_code=r->>'member_code';
    select jsonb_build_object('id',id,'code',code,'label',label,'access_notes',access_notes,'allows_training',allows_training) into pack from public.packages where id=r->>'package_id';
    select jsonb_build_object('id',id,'label',label,'duration_months',duration_months) into plan_snapshot from public.membership_plans where id=r->>'plan_id';
    select jsonb_build_object('id',id,'label',label,'percentage',percentage) into discount_snapshot from public.discounts where id=r->>'discount_id';
    insert into public.memberships(member_id,package_id,package_snapshot,plan_id,plan_snapshot,discount_id,discount_snapshot,member_code_snapshot,start_date,duration_months,source_end_date,voucher_reference,remark,record_origin,source_reference)
    values(person,r->>'package_id',pack,r->>'plan_id',plan_snapshot,r->>'discount_id',discount_snapshot,coalesce(r->'source_reference'->'original'->>'Member ID',r->>'member_code'),(r->>'start_date')::date,(r->>'duration_months')::smallint,(r->>'source_end_date')::date,r->>'voucher_reference',r->>'remark','import',r->'source_reference');
  end loop;
  for r in select value from jsonb_array_elements(p->'training') loop
    select id into strict person from public.members where member_code=r->>'member_code';
    insert into public.training_purchases(member_id,service_type,sessions,start_date,end_date,remark,record_origin,source_reference)
    values(person,'pt',(r->>'sessions')::smallint,(r->>'start_date')::date,(r->>'end_date')::date,r->>'remark','import',r->'source_reference');
  end loop;
  counts=jsonb_build_object('members',(select count(*) from public.members),'memberships',(select count(*) from public.memberships),'training',(select count(*) from public.training_purchases),'attendance',(select count(*) from public.attendance));
  if counts->>'members'<>p->'report'->'counts'->>'members' or counts->>'memberships'<>p->'report'->'counts'->>'memberships' or counts->>'training'<>p->'report'->'counts'->>'training' or counts->>'attendance'<>'0' then raise exception 'Import reconciliation failed'; end if;
  insert into public.audit_events(actor_name,entity_type,entity_id,action,changes,reason)
    values('Authorized workbook import','import_batch',p->>'batch','member_import.completed',jsonb_build_object('file',p->>'file','sha256',p->>'sha256','counts',p->'report'->'counts','category_counts',p->'report'->'categoryCounts','recorded_date_is_start',p->'report'->'recordedDateIsStart'),'User requested member information import; attendance files follow separately.');
end ${delimiter};
set constraints all immediate;
select jsonb_build_object('members',(select count(*) from public.members),'memberships',(select count(*) from public.memberships),'training',(select count(*) from public.training_purchases),'attendance',(select count(*) from public.attendance),'codes',(select count(*) from public.member_codes),'packages',(select count(*) from public.packages),'batch_events',(select count(*) from public.audit_events where action='member_import.completed')) as reconciliation;
`;
fs.writeFileSync(path.join(dir,'dry-run.sql'),sql+'rollback;\n');
fs.writeFileSync(path.join(dir,'import.sql'),sql+'commit;\n');
console.log(JSON.stringify({directory:dir,sha256,...plan.report.counts,categories:plan.report.categoryCounts,guestAdjustments:plan.report.guestAdjustments.length,newGuestCodes:plan.report.blankIdRows.length,nameLinkedInfoRows:plan.report.nameLinks,reviewRows:plan.report.review.length,sqlBytes:Buffer.byteLength(sql)}));
