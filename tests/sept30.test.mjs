import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { dashboardGroups } from '../src/prototype/insights.js';
import { shiftDays } from '../src/prototype/domain.js';
import { createPrototypeRepository } from '../src/prototype/repository.js';
import { createLocalAuth, AUTH_KEY } from '../src/prototype/localAuth.js';
import { exportTables, createPrototypeWorkbook } from '../src/prototype/export.js';

const today = '2026-09-30';
const now = () => new Date(today + 'T06:00:00Z');
const store = () => { const values = new Map(); return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}; };

test('traffic circles use active people and exact 9/10/20/21-day boundaries', () => {
  const members = [0,9,10,20,21,null].map((gap,i)=>({id:String(i),category_id:'customer',full_name:'Person '+i,gap}));
  const data = { members:[...members,{id:'archived',archived_at:today},{id:'expired'},{id:'ends-today'}],
    memberships:[...members.map(m=>({id:'ms'+m.id,member_id:m.id,start_date:'2026-09-01',calculated_end_date:'2026-10-01'})),{member_id:'archived',start_date:'2026-09-01',calculated_end_date:'2026-10-01'},{member_id:'expired',start_date:'2026-08-01',calculated_end_date:'2026-09-01'},{member_id:'ends-today',start_date:'2026-09-01',calculated_end_date:today}],
    attendance:members.filter(m=>m.gap!==null).map(m=>({member_id:m.id,attendance_date:shiftDays(today,-m.gap)})) };
  data.attendance.push({member_id:'4',attendance_date:today,voided_at:today},{member_id:'4',attendance_date:shiftDays(today,1)});
  const groups=dashboardGroups(data,today);
  assert.equal(groups.active.length,6);
  assert.deepEqual(groups.quiet10.map(m=>m.days_since_visit),[10,20]);
  assert.deepEqual(groups.quiet20.map(m=>m.days_since_visit),[21]);
  assert.equal(groups.unvisited.length,1);
  assert.equal(groups.unvisited[0].days_since_visit,null);
});

test('shared vouchers stay text on separate memberships; payment ignored without deleting history', () => {
  const repo=createPrototypeRepository(store(),now);
  const previous=structuredClone(repo.getSnapshot().memberships);
  for (const name of ['Voucher Person A','Voucher Person B']) {
    const member=repo.saveMember({full_name:name,category_id:'customer'}).member;
    const record=repo.addMembership({member_id:member.id,package_id:'gym',plan_id:'plan-1',start_date:today,voucher_reference:'00123',payment_method_id:'ignored'}).membership;
    assert.equal(record.voucher_reference,'00123');
    assert.equal(record.payment_method_id,undefined);
  }
  const data=repo.getSnapshot();
  for (const old of previous) assert.deepEqual(data.memberships.find(m=>m.id===old.id),old);
  const table=exportTables(data,{start:today,end:today}).find(t=>t.name==='Memberships');
  assert.ok(!table.headers.includes('Payment method'));
  assert.equal(table.rows.filter(r=>r[8]==='00123').length,2);
  const xml=strFromU8(unzipSync(createPrototypeWorkbook(data,{start:today,end:today}))['xl/worksheets/sheet3.xml']);
  assert.match(xml,/<t xml:space="preserve">00123<\/t>/);
});

test('attendance workbook merges month headers and freezes two rows across leap/year boundaries', () => {
  const repo=createPrototypeRepository(store(),now);
  repo.saveMember({full_name:'Matrix Test Person',category_id:'customer'});
  for (const [start,end,labels,merges] of [
    ['2024-02-28','2024-03-02',['February 2024','March 2024'],['D1:E1','F1:G1']],
    ['2025-12-31','2026-01-02',['December 2025','January 2026'],['E1:F1']],
    [today,today,['September 2026'],[]],
  ]) {
    const xml=strFromU8(unzipSync(createPrototypeWorkbook(repo.getSnapshot(),{start,end}))['xl/worksheets/sheet4.xml']);
    for (const label of labels) assert.ok(xml.includes(label));
    for (const merge of merges) assert.ok(xml.includes('ref="'+merge+'"'));
    assert.ok(xml.includes('xSplit="3" ySplit="2" topLeftCell="D3"'));
    assert.ok(xml.includes('<autoFilter ref="A2:'));
    assert.ok(xml.includes('<row r="3"'));
  }
});

test('Admin accepts six characters, rejects five, and retains hashed storage', async () => {
  const storage=store(),auth=createLocalAuth(storage,store(),now);
  await auth.setup({display_name:'Owner',username:'owner',password:'test-owner-only-password'});
  await assert.rejects(()=>auth.createAdmin({display_name:'Short',username:'short',password:'abcde'}),/6–128/);
  await auth.createAdmin({display_name:'Six',username:'six',password:'six123'});
  assert.ok(!storage.getItem(AUTH_KEY).includes('six123'));
  auth.logout();
  assert.equal((await auth.login('six','six123')).role,'admin');
});
