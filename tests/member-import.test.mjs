import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMemberImport } from '../scripts/member-import-mapping.mjs';
const options={file:'fictional.xlsx',sha256:'a'.repeat(64),recordedDateIsStart:true};
const profile=(row,id,name,category)=>({_row:row,'Member ID':id,Name:name,Category:category,Phone:'001234',Age:null});
const history=(row,id,name,type='Membership')=>({_row:row,'Member ID':id,Name:name,'Record Type':type,'Recorded Date':'2026-07-01T00:00:00','Expiry Date':'2026-08-01T00:00:00',Package:'Gym',Plan:'3 Months','Voucher No.':'00007',Notes:'Original history'});
test('workbook mapping retains people, shared vouchers, source expiry and original rows',()=>{
 const source={Members:[profile(2,'C001','Same Name','Customer'),profile(3,'C002','Same Name','Customer'),profile(4,'G01','Guest A','Guest'),profile(5,null,'Guest B',null)],Member_Info:[history(2,'C001','Same Name'),history(3,'C002','Same Name'),{...history(4,null,'Guest B','Guest Day Pass'),Package:null,Plan:null}]};
 const before=structuredClone(source),p=prepareMemberImport(source,options);
 assert.deepEqual(source,before);assert.equal(p.members.length,4);assert.equal(p.memberships.length,2);
 assert.deepEqual(p.members.map(m=>m.member_code),['C001','C002','G001','G002']);
 assert.deepEqual(p.members[2].aliases,['G01']);assert.equal(p.members[3].category_id,'guest');
 assert.equal(p.memberships[0].source_end_date,'2026-08-01');assert.equal(p.memberships[0].calculated_end_date,null);
 assert.equal(p.memberships[0].start_date,'2026-07-01');assert.equal(p.memberships[0].voucher_reference,'00007');
 assert.equal(p.memberships[1].voucher_reference,'00007');assert.match(p.members[0].remark,/differs from source/);
 assert.deepEqual(p.members[3].source_reference.remark_only_records,[source.Member_Info[2]]);
 assert.deepEqual(p.report.counts,{members:4,memberships:2,training:0,remarkOnly:1,sourceInfo:3,attendance:0});
});
test('ambiguous missing ID, conflicting identity and normalized guest collision abort mapping',()=>{
 const members=[profile(2,'C001','Same','Customer'),profile(3,'C002','Same','Customer')];
 assert.throws(()=>prepareMemberImport({Members:members,Member_Info:[history(2,null,'Same')]},options),/Ambiguous/);
 assert.throws(()=>prepareMemberImport({Members:members,Member_Info:[history(2,'C001','Different')]},options),/conflicting identity/);
 assert.throws(()=>prepareMemberImport({Members:[profile(2,'G01','One','Guest'),profile(3,'G001','Two','Guest')],Member_Info:[]},options),/Conflicting member code/);
});
test('PT and unsupported history keep unknowns and remarks without inventing package or dates',()=>{
 const info=[{...history(2,'C001','Person','PT'),'PT Sessions':50,Package:null,'Expiry Date':null},history(3,'C001','Person','Legacy class only')];
 const p=prepareMemberImport({Members:[{...profile(2,'C001','Person','Customer'),Age:16}],Member_Info:info},options);
 assert.equal(p.memberships.length,0);assert.equal(p.training.length,1);assert.equal(p.training[0].end_date,null);assert.equal(p.training[0].duration_months,null);
 assert.match(p.training[0].remark,/00007/);assert.equal(p.members[0].date_of_birth,null);assert.match(p.members[0].remark,/Source age: 16/);
 assert.match(p.members[0].remark,/Legacy class only/);assert.equal(p.report.counts.sourceInfo,2);
});
