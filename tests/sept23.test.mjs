import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalAuth, AUTH_KEY } from '../src/prototype/localAuth.js';
import { createPrototypeRepository, STORAGE_KEY } from '../src/prototype/repository.js';
import { membershipActivity } from '../src/prototype/insights.js';

const now = new Date('2026-09-23T06:30:00Z'); // 13:00 Myanmar
const store = () => { const map=new Map(); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; };
const owner = {display_name:'Test Owner',username:'test.owner',password:'test-only-long-password'};
const member = { full_name:'Test Person',category_id:'customer' };
const plan = {package_id:'gym',plan_id:'plan-1',start_date:'2026-10-01',discount_id:'condo-50'};

test('local setup, password hashing, login and Admin account permissions', async()=>{
  const storage=store(), session=store();
  const auth=createLocalAuth(storage,session,()=>now);
  assert.equal(auth.currentUser(),null);
  const superAdmin=await auth.setup(owner);
  assert.equal(superAdmin.role,'super_admin');
  assert.equal(auth.currentUser().id,superAdmin.id);
  assert.equal(createLocalAuth(storage,session,()=>new Date(now.getTime()+8*60*60*1000)).currentUser(),null,'Sessions expire at eight hours');
  assert.equal(storage.getItem(AUTH_KEY).includes(owner.password),false);
  assert.equal(auth.listAccounts()[0].password_hash,undefined);
  await assert.rejects(()=>auth.setup(owner),/already/);
  const admin=await auth.createAdmin({display_name:'Reception',username:'reception',password:'another-test-password'});
  await assert.rejects(()=>auth.createAdmin({display_name:'Duplicate',username:'RECEPTION',password:'another-test-password'}),/already in use/);
  auth.logout();
  await assert.rejects(()=>auth.login('reception','wrong'),/incorrect/);
  assert.equal(auth.currentUser(),null);
  await auth.login('RECEPTION','another-test-password');
  assert.equal(auth.currentUser().role,'admin');
  assert.throws(()=>auth.listAccounts(),/Only Admin/);
  assert.throws(()=>auth.deleteAdmin(superAdmin.id),/Only Admin/);
  await assert.rejects(()=>auth.createAdmin(owner),/Only Admin/);
  const second=createLocalAuth(storage,store(),()=>now);
  await second.login(owner.username,owner.password);
  assert.throws(()=>second.deleteAdmin(superAdmin.id),/Admin account is kept/);
  second.deleteAdmin(admin.id);
  assert.equal(auth.currentUser(),null,'Deletion revokes an already signed-in account');
  await assert.rejects(()=>auth.login('reception','another-test-password'),/incorrect/);
  assert.equal(createLocalAuth(storage,session,()=>new Date('2026-09-24')).currentUser(),null);
});

test('local storage failures preserve saved accounts and never authenticate',async()=>{
  const storage=store(),session=store(),auth=createLocalAuth(storage,session,()=>now);
  storage.setItem=()=>{throw new Error('disk full');};
  await assert.rejects(()=>auth.setup(owner),/disk full/);
  assert.equal(auth.currentUser(),null);
  const corrupt=store();corrupt.setItem(AUTH_KEY,'{"version":7}');
  await assert.rejects(()=>createLocalAuth(corrupt,store()).setup(owner),/could not be read/);
  assert.equal(corrupt.getItem(AUTH_KEY),'{"version":7}');
});

test('Super Admin edits preserve snapshots; Admin and signed-out mutations are rejected',()=>{
  let actor={id:'owner-test',display_name:'Owner',role:'super_admin'};
  const storage=store(),repo=createPrototypeRepository(storage,()=>now,()=>actor);
  const person=repo.saveMember(member).member;
  const first=repo.addMembership({...plan,member_id:person.id}).membership;
  const original=structuredClone(first);
  const pack=repo.getSnapshot().packages.find(p=>p.id==='gym');
  const edited=repo.saveCatalogue('packages',{...pack,label:'Gym Plus',expected_updated_at:pack.updated_at},pack.id).row;
  const discount=repo.getSnapshot().discounts.find(d=>d.id==='condo-50');
  repo.saveCatalogue('discounts',{...discount,label:'Condo 40%',percentage:40,expected_updated_at:discount.updated_at},discount.id);
  assert.deepEqual(repo.getSnapshot().memberships.find(m=>m.id===first.id),original);
  assert.equal(original.created_by,'owner-test');
  const renewed=repo.addMembership({...plan,member_id:person.id}).membership;
  assert.equal(renewed.package_snapshot.label,'Gym Plus');
  assert.equal(renewed.discount_snapshot.percentage,40);
  assert.throws(()=>repo.saveCatalogue('packages',{...pack,label:'Stale edit'},pack.id),/record changed/);
  actor={id:'admin-test',display_name:'Admin',role:'admin'};
  assert.throws(()=>repo.saveCatalogue('packages',{...edited,label:'Denied'},pack.id),/Only Admin/);
  repo.setCatalogueStatus('packages',pack.id,false);
  repo.saveCatalogue('packages',{label:'New option',enabled:true});
  assert.equal(repo.getSnapshot().audit_events[0].actor_user_id,'admin-test');
  actor=null;
  assert.throws(()=>repo.saveMember(member),/sign in/);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).memberships.find(m=>m.id===first.id).package_snapshot.label,'Gym');
});

test('manual check-in uses the same Myanmar day, rejects invalid/future times and preserves duplicates',()=>{
  const repo=createPrototypeRepository(store(),()=>now);
  const person=repo.saveMember(member).member;
  for(const time of ['25:00','12:75','9:30','13:01']) assert.throws(()=>repo.checkIn(person.id,true,time),/valid|future/);
  const manual=repo.checkIn(person.id,true,'09:15').attendance;
  assert.equal(manual.checked_in_at,'2026-09-23T02:45:00.000Z');
  assert.equal(manual.attendance_date,'2026-09-23');
  assert.equal(manual.recorded_at,now.toISOString());
  assert.equal(manual.time_source,'manual');
  assert.equal(repo.checkIn(person.id,true,'10:00').attendance.checked_in_at,manual.checked_in_at);
  const next=repo.saveMember(member).member;
  assert.equal(repo.checkIn(next.id,true).attendance.checked_in_at,now.toISOString());
  repo.updateAttendanceTime(manual.id,{expected_checked_in_at:manual.checked_in_at,time:'10:00',reason:'Reviewed reception log'});
  assert.equal(repo.getSnapshot().attendance.find(a=>a.id===manual.id).original_checked_in_at,manual.checked_in_at);
});

test('New/Renew counts saved transactions today, not membership start dates or profiles',()=>{
  const repo=createPrototypeRepository(store(),()=>now);
  const person=repo.saveMember(member).member;
  repo.saveMember({full_name:'Trial only',category_id:'guest'});
  repo.addMembership({...plan,member_id:person.id});
  repo.addMembership({...plan,member_id:person.id,start_date:'2026-11-01'});
  const data=structuredClone(repo.getSnapshot());
  const rows=membershipActivity(data,'2026-09-23').filter(m=>m.member_id===person.id);
  assert.deepEqual(rows.map(m=>m.activity_kind).sort(),['New','Renew']);
  assert.equal(rows.length,2);
  data.memberships=[{id:'a',member_id:person.id,created_at:'2026-09-22T17:29:59Z'},
    {id:'b',member_id:person.id,created_at:'2026-09-22T17:30:00Z'},
    {id:'c',member_id:person.id,created_at:now.toISOString(),voided_at:now.toISOString()}];
  assert.deepEqual(membershipActivity(data,'2026-09-23').map(m=>m.id),['b']);
});
