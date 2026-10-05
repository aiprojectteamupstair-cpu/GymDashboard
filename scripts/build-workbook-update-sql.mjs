import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const dir='.private-imports/update-2026-10-03/';
const read=name=>JSON.parse(fs.readFileSync(dir+name));
const reconciliation=read('reconciliation-plan.json'), attendance=read('attendance-update-plan.json');
const before=read('before-members.json');
const batch=`update-${reconciliation.source.sha256.slice(0,12)}-${attendance.report.source.sha256.slice(0,12)}`;
assert.equal(reconciliation.issues.length,0);assert.equal(attendance.conflicts.length,0);assert.equal(reconciliation.missingHistory.length,0);
const notes=new Map();
const addNote=(id,note)=>{if(note)notes.set(id,[...(notes.get(id)||[]),note]);};
const stable=row=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>!['_row','Member ID','Name'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
let newRemarkRecords=0;
for(const mapping of reconciliation.mappings) {
  const old=before.find(row=>row.id===mapping.member_id);
  if(!old)continue;
  if(mapping.original.Notes&&mapping.original.Notes!==old.source_reference.original?.Notes)addNote(old.id,`Members row ${mapping.original._row}: ${mapping.original.Notes}`);
  for(const note of mapping.notes)addNote(old.id,note);
  if(!mapping.original['Member ID']&&old.source_reference.original?.['Member ID'])addNote(old.id,`Updated workbook ID is blank; retained existing ${old.member_code} using matching original profile fields. Workbook ${old.source_reference.original['Member ID']} now identifies a different source profile; no identities merged.`);
  const prepared=reconciliation.plan.members.find(row=>row.id===old.id);
  for(const row of prepared.source_reference.remark_only_records) {
    if(!(old.source_reference.remark_only_records||[]).some(prior=>stable(prior)===stable(row))) {
      newRemarkRecords++;
      addNote(old.id,`Member_Info row ${row._row}: ${Object.entries(row).filter(([key,value])=>!['_row','Name','Member ID'].includes(key)&&value!=null).map(([key,value])=>`${key}: ${value}`).join('; ')}`);
    }
  }
}
for(const row of reconciliation.newHistory)if(row.remark&&before.some(member=>member.id===row.member_id))addNote(row.member_id,`Member_Info row ${row.source_reference.row}: ${row.remark}`);
for(const row of reconciliation.changed)addNote(row.before.member_id,`Member_Info row ${row.after.source_reference.row}: Source expiry clarified as ${row.after.source_end_date}. Earlier unknown-expiry note is superseded; previous record retained in audit.`);
for(const note of attendance.notes)addNote(note.member_id,`Attendance ${note.sheet} row ${note.row}: ${note.note}`);
const updates=[];
for(const old of before) {
  const changes=reconciliation.profileChanges.find(row=>row.id===old.id)?.fields||{};
  const additions=[...new Set(notes.get(old.id)||[])];
  if(!additions.length&&!Object.keys(changes).length)continue;
  const mapping=reconciliation.mappings.find(row=>row.member_id===old.id);
  updates.push({before:old,fields:{full_name:old.full_name,contact_phone:old.contact_phone,student_id:old.student_id,member_code:old.member_code,category_id:old.category_id,...changes},remark:[old.remark,`[Workbook update through 2026-10-03]\n${additions.join('\n')}`].filter(Boolean).join('\n'),source_reference:{...old.source_reference,updates:{...(old.source_reference.updates||{}),[batch]:{...reconciliation.source,sheet:'Members',row:mapping.original._row,original:mapping.original,link_method:mapping.link,notes:additions}}},previous_code:mapping.previous_code});
}
const newMembers=reconciliation.plan.members.filter(row=>reconciliation.mappings.some(m=>m.member_id===row.id&&!m.existing_id)).map(row=>({...row,remark:[row.remark,...new Set(notes.get(row.id)||[])].filter(Boolean).join('\n')}));
const newMemberships=reconciliation.newHistory.map(row=>({...row,id:randomUUID()}));
assert.ok(newMemberships.every(row=>row.table==='memberships'),'New PT mapping requires its own insert path');
for(const row of reconciliation.changed) {
  assert.equal(row.before.source_end_date,null);assert.ok(row.after.source_end_date);
  for(const key of ['start_date','package_id','plan_id','discount_id','duration_months','voucher_reference'])assert.equal(row.before[key],row.after[key],`Unreviewed history change: ${key}`);
}
const groups=new Map();
for(const {date,...visit} of attendance.additions) {
  const key=JSON.stringify(visit);
  if(!groups.has(key))groups.set(key,{...visit,dates:[]});groups.get(key).dates.push(date);
}
const payload={batch,source:reconciliation.source,attendanceSource:attendance.report.source,newMembers,updates,newMemberships,historyUpdates:reconciliation.changed,attendance:[...groups.values()],excluded:reconciliation.excluded,reviews:attendance.reviews,summary:{newMembers:newMembers.length,updatedMembers:updates.length,newMemberships:newMemberships.length,newAttendance:attendance.additions.length,expiryUpdates:reconciliation.changed.length,newRemarkRecords,attendance:attendance.report},baseline:{members:before.length,memberships:read('before-memberships.json').length,training:read('before-training_purchases.json').length,attendance:read('before-attendance-keys.json').length}};
fs.writeFileSync(dir+'update-payload.json',JSON.stringify(payload,null,2));
const json=JSON.stringify(payload).replaceAll("'","''");
const sql=`begin;
set local standard_conforming_strings=on;
set local statement_timeout='90s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(7152026);
lock table public.members,public.member_codes,public.memberships,public.training_purchases,public.attendance,public.audit_events in share row exclusive mode;
do $workbook_update$
declare p jsonb := '${json}'::jsonb; r jsonb; d text; m public.members; previous jsonb; after_row jsonb; pack jsonb; plan_snapshot jsonb; discount_snapshot jsonb;
begin
  if exists(select 1 from public.audit_events where action='workbook_update.completed' and entity_id=p->>'batch') then return; end if;
  if (select count(*) from public.members)<>(p->'baseline'->>'members')::int
    or (select count(*) from public.memberships)<>(p->'baseline'->>'memberships')::int
    or (select count(*) from public.training_purchases)<>(p->'baseline'->>'training')::int
    or (select count(*) from public.attendance)<>(p->'baseline'->>'attendance')::int then raise exception 'Live counts changed; reconcile again'; end if;
  if exists(select 1 from public.members where member_code='C123') then raise exception 'Previously deleted member has reappeared; review'; end if;
  for r in select value from jsonb_array_elements(p->'updates') loop
    select * into strict m from public.members where id=(r->'before'->>'id')::uuid;
    if to_jsonb(m) is distinct from to_jsonb(jsonb_populate_record(null::public.members,r->'before')) then raise exception 'Member changed since backup'; end if;
    if r->>'previous_code' is not null then
      update public.member_codes set retired_at=now() where member_id=m.id and retired_at is null;
      insert into public.member_codes(code,member_id,category_id) values(r->'fields'->>'member_code',m.id,r->'fields'->>'category_id');
    end if;
    update public.members set full_name=r->'fields'->>'full_name',contact_phone=r->'fields'->>'contact_phone',student_id=r->'fields'->>'student_id',
      member_code=r->'fields'->>'member_code',category_id=r->'fields'->>'category_id',remark=r->>'remark',source_reference=r->'source_reference',updated_at=clock_timestamp()
      where id=m.id returning to_jsonb(members.*) into after_row;
    insert into public.audit_events(actor_name,entity_type,entity_id,action,changes,reason)
      values('Authorized workbook update','members',m.id::text,'member_import.updated',jsonb_build_object('batch',p->>'batch','before',r->'before','after',after_row),'User requested updated workbooks; unclear details retained in remarks.');
  end loop;
  for r in select value from jsonb_array_elements(p->'newMembers') loop
    insert into public.members(id,member_code,full_name,category_id,contact_phone,student_id,remark,record_origin,source_reference)
      values((r->>'id')::uuid,r->>'member_code',r->>'full_name',r->>'category_id',r->>'contact_phone',r->>'student_id',r->>'remark','import',r->'source_reference');
    insert into public.member_codes(code,member_id,category_id) values(r->>'member_code',(r->>'id')::uuid,r->>'category_id');
    for d in select jsonb_array_elements_text(r->'aliases') loop
      insert into public.member_codes(code,member_id,category_id,retired_at) values(d,(r->>'id')::uuid,r->>'category_id',now());
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(p->'newMemberships') loop
    select jsonb_build_object('id',id,'code',code,'label',label,'access_notes',access_notes,'allows_training',allows_training) into pack from public.packages where id=r->>'package_id';
    if pack is null then raise exception 'Missing package'; end if;
    select jsonb_build_object('id',id,'label',label,'duration_months',duration_months) into plan_snapshot from public.membership_plans where id=r->>'plan_id';
    select jsonb_build_object('id',id,'label',label,'percentage',percentage) into discount_snapshot from public.discounts where id=r->>'discount_id';
    insert into public.memberships(id,member_id,package_id,package_snapshot,plan_id,plan_snapshot,discount_id,discount_snapshot,member_code_snapshot,member_category_snapshot,start_date,duration_months,source_end_date,voucher_reference,remark,record_origin,source_reference)
      values((r->>'id')::uuid,(r->>'member_id')::uuid,r->>'package_id',pack,r->>'plan_id',plan_snapshot,r->>'discount_id',discount_snapshot,r->>'member_code',
        (select c.label from public.members person join public.member_categories c on c.id=person.category_id where person.id=(r->>'member_id')::uuid),
        (r->>'start_date')::date,(r->>'duration_months')::smallint,(r->>'source_end_date')::date,r->>'voucher_reference',r->>'remark','import',r->'source_reference');
  end loop;
  for r in select value from jsonb_array_elements(p->'historyUpdates') loop
    select to_jsonb(h) into previous from public.memberships h where id=(r->'before'->>'id')::uuid;
    if previous is distinct from to_jsonb(jsonb_populate_record(null::public.memberships,r->'before')) then raise exception 'Membership changed since backup'; end if;
    update public.memberships set source_end_date=(r->'after'->>'source_end_date')::date,updated_at=clock_timestamp(),
      remark=remark || E'\\n[Update through 2026-10-03] Source expiry now confirmed as ' || (r->'after'->>'source_end_date') || '. Earlier unknown-expiry note superseded.',
      source_reference=source_reference || jsonb_build_object('latest_update',r->'after'->'source_reference')
      where id=(r->'before'->>'id')::uuid returning to_jsonb(memberships.*) into after_row;
    insert into public.audit_events(actor_name,entity_type,entity_id,action,changes,reason)
      values('Authorized workbook update','memberships',r->'before'->>'id','membership_import.corrected',jsonb_build_object('batch',p->>'batch','before',previous,'after',after_row),'Updated source supplies previously unknown expiry; identity and other history retained.');
  end loop;
  for r in select value from jsonb_array_elements(p->'attendance') loop
    for d in select jsonb_array_elements_text(r->'dates') loop
      insert into public.attendance(member_id,attendance_date,checked_in_at,time_source,member_code_snapshot,member_category_snapshot,record_origin,source_reference)
        values((r->>'member_id')::uuid,d::date,null,'import_date_only',r->>'code',r->>'category','import',
          jsonb_build_object('batch',p->>'batch','file',p->'attendanceSource'->>'file','sha256',p->'attendanceSource'->>'sha256','sheet',r->>'sheet','row',r->'row',
            'date',d,'original_time',null,'source_code',r->'source_code','source_name',r->>'original_name','source_category',r->'original_category','link_method',r->>'link_method'));
    end loop;
  end loop;
  if (select count(*) from public.members)<>(p->'baseline'->>'members')::int+(p->'summary'->>'newMembers')::int
    or (select count(*) from public.memberships)<>(p->'baseline'->>'memberships')::int+(p->'summary'->>'newMemberships')::int
    or (select count(*) from public.training_purchases)<>(p->'baseline'->>'training')::int
    or (select count(*) from public.attendance)<>(p->'baseline'->>'attendance')::int+(p->'summary'->>'newAttendance')::int then raise exception 'Import count reconciliation failed'; end if;
  insert into public.audit_events(actor_name,entity_type,entity_id,action,changes,reason)
    values('Authorized workbook update','import_batch',p->>'batch','workbook_update.completed',jsonb_build_object('source',p->'source','attendance_source',p->'attendanceSource','summary',p->'summary','excluded',p->'excluded','reviews',p->'reviews'),
      'User supplied updated member and attendance workbooks through October 3. No deletion, inferred absence, fabricated time, Auth or grant change.');
end $workbook_update$;
set constraints all immediate;
`;
const countQuery=`select jsonb_build_object('members',(select count(*) from public.members),'memberships',(select count(*) from public.memberships),'training',(select count(*) from public.training_purchases),'attendance',(select count(*) from public.attendance),'batch_events',(select count(*) from public.audit_events where action='workbook_update.completed' and entity_id='${batch}')) as counts;`;
fs.writeFileSync(dir+'update-dry-run.sql',sql+"rollback; select 'All import assertions passed; rolled back' as verification;");
fs.writeFileSync(dir+'update-import.sql',sql+'commit;'+countQuery);
console.log(JSON.stringify({batch,bytes:Buffer.byteLength(sql),...payload.summary},null,2));
