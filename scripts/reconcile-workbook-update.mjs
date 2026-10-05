import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareMemberImport } from './member-import-mapping.mjs';

const directory=path.resolve('.private-imports/update-2026-10-03');
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
const source=read('members-source.json'), attendanceSource=read('attendance-source.json');
const existing=read('before-members.json'), codes=read('before-member_codes.json');
const history=[...read('before-memberships.json').map(row=>({...row,table:'memberships'})),...read('before-training_purchases.json').map(row=>({...row,table:'training_purchases'}))];
const text=value=>value==null?'':String(value).trim();
const normal=value=>text(value).normalize('NFC').replace(/\s+/g,' ').toLowerCase();
const canonical=value=>/^G\d+$/.test(value)?`G${Number(value.slice(1)).toString().padStart(3,'0')}`:value;
const objects=rows=>rows.slice(1).map((row,index)=>({...Object.fromEntries(rows[0].map((name,i)=>[name,row[i]??null])),_row:index+2}));
const members=objects(source.sheets.Members), info=objects(source.sheets.Member_Info);
const categoryIds={'VIP Customer':'vip',Customer:'customer',Student:'student','Staff/Employee':'staff',Guest:'guest'};
const prefixes={vip:'VC',customer:'C',student:'S',staff:'E',guest:'G'};
const used=new Set([...codes.map(row=>row.code),...members.map(row=>canonical(text(row['Member ID']))).filter(Boolean)]);
function allocate(category) {
  const prefix=prefixes[category];
  const numbers=[...used].filter(code=>new RegExp(`^${prefix}[0-9]+$`).test(code)).map(code=>Number(code.slice(prefix.length)));
  const code=prefix+String(Math.max(0,...numbers)+1).padStart(category==='vip'?2:3,'0'); used.add(code); return code;
}
const mappings=[], excluded=[], issues=[];
const matchedExisting=new Set();
for(const original of members) {
  const sourceCode=text(original['Member ID']);
  if(sourceCode==='C123') { excluded.push({sheet:'Members',row:original._row,reason:'Previously user-deleted duplicate C123; do not recreate',original}); continue; }
  const notes=[];
  let current=sourceCode?existing.find(row=>text(row.source_reference.original?.['Member ID'])===sourceCode&&normal(row.full_name)===normal(original.Name)):null;
  let link='source_id_and_name';
  const previous=text(original.Notes).match(/Previously (G\d+); became Staff\/Employee on (\d{4}-\d{2}-\d{2})/);
  if(previous&&!current) {
    current=existing.find(row=>row.member_code===canonical(previous[1])&&normal(row.full_name)===normal(original.Name));
    assert.ok(current,'Conversion source identity missing'); link='explicit_source_category_conversion';
    notes.push(`Source confirms ${previous[1]} became ${sourceCode} on ${previous[2]}. Stable member identity and previous history retained.`);
  }
  if(!sourceCode) {
    const candidates=existing.filter(row=>['Name','Category','Phone','Student ID','Age'].every(key=>normal(row.source_reference.original?.[key])===normal(original[key])));
    assert.ok(candidates.length<=1,'Ambiguous prior-source profile');
    current=candidates[0]; link='matching_prior_source_profile_fields';
  }
  const category=categoryIds[text(original.Category)]||(!text(original.Category)?'guest':null);
  assert.ok(category,'Unknown category');
  let code=current?.member_code || canonical(sourceCode);
  if(previous) code=sourceCode;
  if(!current) {
    link=sourceCode?'new_source_id':'new_blank_id_source_profile';
    const collision=codes.find(row=>row.code===code);
    if(!code||collision) {
      code=allocate(category);
      notes.push(sourceCode?`Workbook ID ${sourceCode} conflicts with an existing ID reservation. Assigned ${code}; no existing person was merged or overwritten.`:`Source Member ID is blank. Assigned ${code}; identity remains as listed in the workbook.`);
    }
    if(text(original.Notes).includes('identity unconfirmed')) notes.push('Provisional separate source profile; possible spelling match remains unconfirmed. No histories merged.');
    if(!original.Category) notes.push('Source category not established; provisionally Guest.');
  }
  assert.match(code,new RegExp(`^${prefixes[category]}[0-9]+$`));
  if(current) {assert.ok(!matchedExisting.has(current.id),'Two source profiles map to one existing person');matchedExisting.add(current.id);}
  mappings.push({original,member_id:current?.id||randomUUID(),member_code:code,category_id:category,existing_id:current?.id||null,link,notes,previous_code:previous?current.member_code:null});
}
assert.equal(matchedExisting.size,existing.length,'Existing source profiles missing from new master');
const byCode=new Map(mappings.filter(row=>row.original['Member ID']).map(row=>[row.original['Member ID'],row]));
const infoMappings=[];
for(const row of info) {
  if(row['Member ID']==='C123') {excluded.push({sheet:'Member_Info',row:row._row,reason:'Deleted C123 history retained in import audit only, not restored',original:row});continue;}
  let mapping=byCode.get(row['Member ID']);
  if(!row['Member ID']) {
    const matches=mappings.filter(m=>normal(m.original.Name)===normal(row.Name));
    assert.equal(matches.length,1,`Ambiguous blank-ID history row ${row._row}`);mapping=matches[0];
  }
  assert.ok(mapping&&normal(mapping.original.Name)===normal(row.Name),`History identity conflict at ${row._row}`);
  infoMappings.push({original:row,mapping});
}
// Reuse the established package/date mapping, then restore untouched source provenance.
const plan=prepareMemberImport({Members:mappings.map(m=>({...m.original,'Member ID':m.member_code})),Member_Info:infoMappings.map(({original,mapping})=>({...original,'Member ID':mapping.member_code}))},{file:source.file,sha256:source.sha256,recordedDateIsStart:true});
const mappedByRow=new Map(mappings.map(m=>[m.original._row,m]));
const rawInfoByRow=new Map(infoMappings.map(m=>[m.original._row,m]));
for(const member of plan.members) {
  const m=mappedByRow.get(member.source_reference.row);
  member.id=m.member_id;member.source_reference.original=m.original;member.source_reference.link_method=m.link;
  member.source_reference.remark_only_records=member.source_reference.remark_only_records.map(row=>rawInfoByRow.get(row._row).original);
  member.remark=[member.remark,...m.notes].filter(Boolean).join('\n');
  member.aliases=[];
  const sourceCode=text(m.original['Member ID']);
  if(sourceCode&&sourceCode!==member.member_code&&!codes.some(row=>canonical(row.code)===canonical(sourceCode)))member.aliases.push(sourceCode);
}
for(const record of [...plan.memberships,...plan.training]) {
  const mapping=rawInfoByRow.get(record.source_reference.row);
  record.member_id=mapping.mapping.member_id;
  record.source_reference.original=mapping.original;
  record.source_reference.link_method=mapping.mapping.link;
}
const stable=(original,skip=[])=>JSON.stringify(Object.fromEntries(Object.entries(original).filter(([key])=>!['_row','Member ID','Name',...skip].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
const consumed=new Set(), unchanged=[], changed=[], newHistory=[];
for(const record of [...plan.memberships.map(row=>({...row,table:'memberships'})),...plan.training.map(row=>({...row,table:'training_purchases'}))]) {
  const candidates=history.filter(row=>row.member_id===record.member_id&&row.table===record.table&&!consumed.has(row.id));
  let matches=candidates.filter(row=>stable(row.source_reference.original)===stable(record.source_reference.original));
  let kind='unchanged';
  if(!matches.length) {matches=candidates.filter(row=>stable(row.source_reference.original,['Notes'])===stable(record.source_reference.original,['Notes']));kind='notes';}
  if(!matches.length) {
    const raw=record.source_reference.original;
    matches=candidates.filter(row=>raw['Voucher No.']&&row.source_reference.original['Voucher No.']===raw['Voucher No.']&&row.source_reference.original['Recorded Date']===raw['Recorded Date']&&row.source_reference.original['Record Type']===raw['Record Type']);kind='fields';
  }
  if(matches.length===1) {
    consumed.add(matches[0].id);
    (kind==='unchanged'?unchanged:changed).push({before:matches[0],after:record,kind});
  } else if(matches.length>1) issues.push({type:'ambiguous_history',row:record.source_reference.row,candidates:matches.map(m=>m.id)});
  else newHistory.push(record);
}
const missingHistory=history.filter(row=>!consumed.has(row.id));
const profileChanges=[];
for(const mapping of mappings.filter(m=>m.existing_id)) {
  const before=existing.find(row=>row.id===mapping.member_id);
  const fields={};
  for(const [column,key] of [['full_name','Name'],['contact_phone','Phone'],['student_id','Student ID']]) {
    const value=text(mapping.original[key])||null;
    if(value!==null&&value!==before[column]) fields[column]=value;
  }
  if(mapping.previous_code){fields.member_code=mapping.member_code;fields.category_id=mapping.category_id;}
  else assert.equal(before.category_id,mapping.category_id,'Unreviewed category change');
  if(Object.keys(fields).length)profileChanges.push({id:before.id,code:before.member_code,fields,original:mapping.original});
}
const report={newMembers:mappings.filter(m=>!m.existing_id).map(m=>({row:m.original._row,name:m.original.Name,sourceCode:m.original['Member ID'],assignedCode:m.member_code,notes:m.notes})),profileChanges,unchangedHistory:unchanged.length,changedHistory:changed.map(r=>({kind:r.kind,old:r.before.source_reference.original,new:r.after.source_reference.original})),newHistory:newHistory.map(r=>({table:r.table,original:r.source_reference.original})),missingHistory:missingHistory.map(r=>({table:r.table,original:r.source_reference.original})),excluded,issues};
fs.writeFileSync(path.join(directory,'reconciliation-plan.json'),JSON.stringify({source:{file:source.file,sha256:source.sha256},attendanceSource:{file:attendanceSource.file,sha256:attendanceSource.sha256},plan,mappings,infoMappings:infoMappings.map(m=>({original:m.original,member_id:m.mapping.member_id})),unchanged,changed,newHistory,missingHistory,profileChanges,excluded,issues},null,2));
fs.writeFileSync(path.join(directory,'reconciliation-review.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,newMembers:report.newMembers.length,profileChanges:report.profileChanges.length,newHistory:report.newHistory.length,missingHistory:report.missingHistory.length,excluded:report.excluded.length},null,2));
