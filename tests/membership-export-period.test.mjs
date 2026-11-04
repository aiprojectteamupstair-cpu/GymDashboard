import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { createPrototypeWorkbook, exportTables } from '../src/prototype/export.js';

const period={start:'2026-10-01',end:'2026-10-31'};
function fixture() {
  const data=createEmptyData();
  data.members=['three','six','year','expired','future','edge','renew','guest','unknown','void','archived'].map((id,index)=>({id,member_code:`C${String(index+1).padStart(3,'0')}`,full_name:id,category_id:id==='guest'?'guest':'customer',contact_phone:'00123',remark:'Original note'}));
  data.members.find(row=>row.id==='archived').archived_at='2026-11-01';
  const plan=(id,member_id,start_date,calculated_end_date)=>({id,member_id,start_date,calculated_end_date,member_category_snapshot:'Customer',package_snapshot:{label:'Gym'},voucher_reference:id});
  data.memberships=[plan('three-plan','three','2026-08-15','2026-11-15'),plan('six-plan','six','2026-05-10','2026-11-10'),plan('year-plan','year','2026-01-01','2027-01-01'),
    plan('expired-plan','expired','2026-06-30','2026-09-30'),plan('future-plan','future','2026-11-01','2027-02-01'),plan('edge-plan','edge','2026-09-01','2026-10-01'),
    plan('renew-old','renew','2026-09-15','2026-10-15'),plan('renew-new','renew','2026-10-16','2027-01-16'),plan('renew-irrelevant','renew','2025-01-01','2025-04-01'),
    plan('unknown-plan','unknown',null,'2026-11-01'),{...plan('void-plan','void','2026-10-01','2026-11-01'),voided_at:'2026-10-02'},plan('archived-plan','archived','2026-09-30','2026-10-31')];
  data.attendance=['expired','guest'].map(id=>({id:`visit-${id}`,member_id:id,attendance_date:'2026-10-02',member_category_snapshot:id==='guest'?'Guest':'Customer'}));
  return data;
}
const sheet=(tables,name)=>tables.find(table=>table.name===name);

test('selected period includes long plans and boundary expiries but not old/future/void memberships or unpaid guests',()=>{
  const data=fixture(),before=structuredClone(data),tables=exportTables(data,period);
  assert.deepEqual(sheet(tables,'Members').rows.map(row=>row[1]),['three','six','year','edge','renew','archived']);
  assert.equal(sheet(tables,'Memberships').rows.length,7);
  assert.ok(!sheet(tables,'Members').headers.includes('Profile status'));
  const rows=sheet(tables,'Memberships').rows;
  assert.equal(rows.find(row=>row[8]==='three-plan')[5].date,'2026-08-15');
  assert.equal(rows.find(row=>row[8]==='three-plan')[7],'Active');
  assert.equal(rows.find(row=>row[8]==='edge-plan')[7],'Expired');
  assert.equal(rows.find(row=>row[8]==='archived-plan')[7],'Ends today');
  assert.equal(sheet(tables,'Memberships').headers[7],'Status at period end');
  assert.equal(sheet(tables,'Daily attendance').rows[1][1].value,2);
  assert.equal(sheet(tables,'Attendance').rows.reduce((n,row)=>n+row[4],0),2);
  assert.deepEqual(data,before);
});

test('effective expiry honors override then imported expiry and rejects invalid/inverted or unknown dates without inference',()=>{
  const data=fixture();
  data.memberships=[{id:'source',member_id:'three',start_date:'2026-07-01',calculated_end_date:'2026-09-30',source_end_date:'2026-10-03'},
    {id:'override',member_id:'six',start_date:'2026-07-01',source_end_date:'2026-12-01',override_end_date:'2026-09-30'},
    {id:'invalid',member_id:'year',start_date:'2026-02-30',source_end_date:'2026-11-01'},
    {id:'reversed',member_id:'edge',start_date:'2026-10-15',source_end_date:'2026-10-01'},
    {id:'unknown',member_id:'unknown',start_date:'2026-09-01'},
    {id:'provably-old',member_id:'expired',source_end_date:'2026-09-30'}];
  const tables=exportTables(data,period);
  assert.deepEqual(sheet(tables,'Members').rows.map(row=>row[1]),['three']);
  assert.equal(sheet(tables,'Memberships').rows[0][6].date,'2026-10-03');
  const reviews=sheet(tables,'Read me').rows.filter(row=>row[0]==='Membership review');
  assert.equal(reviews.length,3);
  assert.ok(reviews.every(row=>row[1].includes('Excluded because')));
});

test('duplicate IDs collapse, conflicting copies stop export, separate purchases/shared names or vouchers never merge',()=>{
  const data=fixture();
  data.members.push(structuredClone(data.members[0]));
  data.memberships.push(structuredClone(data.memberships[0]));
  for(const row of data.members) row.full_name='Same name';
  for(const row of data.memberships) row.voucher_reference='00077';
  const tables=exportTables(data,period);
  assert.equal(sheet(tables,'Members').rows.length,6);
  assert.equal(sheet(tables,'Memberships').rows.length,7);
  data.memberships.push({...data.memberships[0],start_date:'2026-09-01'});
  assert.throws(()=>exportTables(data,period),/conflicting copies/);
  assert.throws(()=>exportTables({...fixture(),members:[{full_name:'Missing ID'}]},period),/stable ID/);
});

test('membership category snapshots do not become attendance filters or current-category guesses',()=>{
  const data=fixture();
  data.members[0].category_id='student';
  const customer=exportTables(data,{...period,category:'customer'});
  assert.ok(sheet(customer,'Members').rows.some(row=>row[1]==='three'));
  assert.equal(sheet(exportTables(data,{...period,category:'student'}),'Memberships').rows.length,0);
  delete data.memberships[0].member_category_snapshot;
  assert.equal(sheet(exportTables(data,{...period,category:'student'}),'Memberships').rows.length,1);
});

test('partial/invalid scope and orphaned selected records fail rather than producing misleading reports',()=>{
  for(const scope of [{start:period.start},{end:period.end},{start:'bad',end:period.end},{start:period.end,end:period.start}]) assert.throws(()=>exportTables(fixture(),scope),/period/);
  const data=fixture();data.memberships.push({id:'orphan',member_id:'missing',start_date:period.start,calculated_end_date:period.end});
  assert.throws(()=>exportTables(data,period),/profile is missing/);
  data.memberships.pop();data.attendance[0].member_id='missing';
  assert.throws(()=>exportTables(data,period),/missing member/);
});

test('single-day, leap-day and year-boundary overlap is inclusive and independent of export date',()=>{
  const data=fixture();
  data.memberships=[{id:'leap',member_id:'three',start_date:'2023-12-31',calculated_end_date:'2024-02-29'}];
  for(const day of ['2023-12-31','2024-01-01','2024-02-29']) assert.equal(sheet(exportTables(data,{start:day,end:day}),'Members').rows.length,1);
  for(const day of ['2023-12-30','2024-03-01']) assert.equal(sheet(exportTables(data,{start:day,end:day}),'Members').rows.length,0);
});

test('saved XLSX has seven-column Members, literal text/leading zeros and only eligible memberships',()=>{
  const data=fixture();data.members[0].full_name='=Literal name';
  const zip=unzipSync(createPrototypeWorkbook(data,period));
  const members=strFromU8(zip['xl/worksheets/sheet2.xml']),memberships=strFromU8(zip['xl/worksheets/sheet3.xml']);
  assert.match(members,/autoFilter ref="A1:G7"/);assert.doesNotMatch(members,/Profile status/);
  assert.match(members,/00123/);assert.match(members,/=Literal name/);assert.doesNotMatch(members,/<f>/);
  assert.doesNotMatch(memberships,/expired-plan|future-plan|renew-irrelevant/);
  assert.match(memberships,/Status at period end/);
});
