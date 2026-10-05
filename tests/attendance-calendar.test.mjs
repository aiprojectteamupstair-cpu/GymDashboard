import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrototypeRepository, STORAGE_KEY } from '../src/prototype/repository.js';
import { attendanceVersion } from '../src/prototype/attendanceCalendarService.js';
import { createCommandHandler } from '../supabase/functions/gym-commands/handler.js';
import { accountName, roleLabel } from '../src/roles.js';

function setup(role = 'super_admin') {
  const values = new Map();
  const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
  const repo = createPrototypeRepository(storage, () => new Date('2026-10-05T05:00:00Z'), () => ({id:'owner',display_name:'Owner',role}));
  const member = repo.saveMember({full_name:'Calendar Test',category_id:'guest'}).member;
  const input = changes => ({member_id:member.id,reason:'Confirmed against reception log',changes});
  return {repo,member,input,storage};
}

test('Admin calendar adds, corrects, voids and restores the same visit with audited originals', () => {
  const {repo,input} = setup();
  const date='2026-10-02';
  repo.editAttendanceCalendar(input([{date,present:true,time:'09:15',expected:null}]));
  const original=repo.getSnapshot().attendance[0];
  assert.equal(original.checked_in_at,'2026-10-02T02:45:00.000Z');
  assert.equal(original.recorded_at,'2026-10-05T05:00:00.000Z');
  repo.editAttendanceCalendar(input([{date,present:true,time:'10:00',expected:attendanceVersion(original)}]));
  let row=repo.getSnapshot().attendance[0];
  assert.equal(row.original_checked_in_at,original.checked_in_at);
  repo.editAttendanceCalendar(input([{date,present:false,expected:attendanceVersion(row)}]));
  row=repo.getSnapshot().attendance[0];
  assert.ok(row.voided_at);
  repo.editAttendanceCalendar(input([{date,present:true,expected:attendanceVersion(row)}]));
  row=repo.getSnapshot().attendance[0];
  assert.equal(row.id,original.id); assert.equal(row.voided_at,null);
  assert.equal(row.original_checked_in_at,original.checked_in_at);
  assert.equal(repo.getSnapshot().audit_events.filter(event=>event.action==='attendance.calendar').length,4);
});

test('calendar denies Staff, today/future/invalid dates, missing time/reason and stale or duplicate batches', () => {
  const staff=setup('admin');
  assert.throws(()=>staff.repo.editAttendanceCalendar(staff.input([{date:'2026-10-01',present:true,time:'09:00',expected:null}])),/Only Admin/);
  const {repo,input}=setup();
  const before=repo.getSnapshot();
  for(const change of [
    {date:'2026-10-05',present:true,time:'09:00',expected:null},
    {date:'2026-10-06',present:true,time:'09:00',expected:null},
    {date:'2026-02-30',present:true,time:'09:00',expected:null},
    {date:'2026-10-01',present:true,expected:null},
    {date:'2026-10-01',present:true,time:'25:00',expected:null},
    {date:'2026-10-01',present:true,time:'09:00'},
  ]) assert.throws(()=>repo.editAttendanceCalendar(input([change])));
  const valid={date:'2026-10-01',present:true,time:'09:00',expected:null};
  assert.throws(()=>repo.editAttendanceCalendar({...input([valid]),reason:' '}));
  assert.throws(()=>repo.editAttendanceCalendar(input([valid,valid])),/once/);
  assert.deepEqual(repo.getSnapshot(),before);
  repo.editAttendanceCalendar(input([valid]));
  const saved=repo.getSnapshot();
  assert.throws(()=>repo.editAttendanceCalendar(input([{...valid,date:'2026-10-02'},valid])),/changed/);
  assert.deepEqual(repo.getSnapshot(),saved);
});

test('calendar restoration preserves imported unknown times, snapshots and provenance', () => {
  const {repo,member,input,storage}=setup();
  const data=repo.getSnapshot();
  data.attendance.push({id:'imported',member_id:member.id,attendance_date:'2026-09-01',checked_in_at:null,time_source:'import_date_only',record_origin:'import',source_reference:{sheet:'historic'},member_code_snapshot:'OLD01',member_category_snapshot:'Student',voided_at:'2026-10-01T00:00:00Z'});
  storage.setItem(STORAGE_KEY,JSON.stringify(data));
  repo.editAttendanceCalendar(input([{date:'2026-09-01',present:true,expected:attendanceVersion(data.attendance[0])}]));
  const row=repo.getSnapshot().attendance[0];
  assert.equal(row.checked_in_at,null); assert.equal(row.time_source,'import_date_only');
  assert.equal(row.member_code_snapshot,'OLD01'); assert.equal(row.member_category_snapshot,'Student');
  assert.deepEqual(row.source_reference,{sheet:'historic'});
});

test('calendar Edge route enforces verified Admin role and never trusts payload role', async () => {
  let role='admin',calls=0;
  const query={select(){return this;},eq(){return this;},is(){return this;},async maybeSingle(){return {data:{id:'staff',role_code:role}};}};
  const handler=createCommandHandler({userClient:()=>({auth:{getUser:async()=>({data:{user:{id:'verified'}}})},from:()=>query}),adminClient:()=>({rpc:async (name,args)=>{calls++;assert.equal(name,'gym_attendance_calendar');assert.equal(args.actor_auth_id,'verified');assert.equal(args.command,undefined);return {data:{count:1}};}})});
  const invoke=()=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({command:'attendance.calendar',request_id:crypto.randomUUID(),payload:{role:'super_admin'}})}));
  assert.equal((await invoke()).status,403); assert.equal(calls,0);
  role='super_admin'; assert.equal((await invoke()).status,200); assert.equal(calls,1);
});

test('account labels change without changing role identifiers or personal names', () => {
  assert.equal(roleLabel('super_admin'),'Admin'); assert.equal(roleLabel('admin'),'Staff');
  assert.equal(accountName({display_name:'Super Admin'}),'Admin');
  assert.equal(accountName({display_name:'Reception'}),'Reception');
});
