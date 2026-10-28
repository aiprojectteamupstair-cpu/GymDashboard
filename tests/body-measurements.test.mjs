import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { createPrototypeRepository, STORAGE_KEY } from '../src/prototype/repository.js';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { bodyFatPercent, kgToLb, lbToKg, measurementInputs, measurementHistory, measurementSeries, validateMeasurement } from '../src/prototype/bodyMeasurements.js';
import { createPrototypeWorkbook, exportTables } from '../src/prototype/export.js';
import { memberPath, resolveRoute } from '../src/routes.js';
import { createCommandHandler } from '../supabase/functions/gym-commands/handler.js';

function setup(role='admin') {
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const repo=createPrototypeRepository(storage,()=>new Date('2026-10-28T05:00:00Z'),()=>({id:'staff',role}));
  const member=repo.saveMember({full_name:'Measurement Fixture',category_id:'customer'}).member;
  const input={member_id:member.id,measurement_month:'2026-10-01',weight_kg:'80',fat_mass_kg:'20',skeletal_muscle_kg:'32',body_fat_percent:99};
  return {repo,member,input,storage};
}

for(const role of ['super_admin','admin']) test(`${role} monthly measurements retain calculations, audit, stale guards and soft deletion`,()=>{
  const {repo,input,member}=setup(role);
  repo.saveBodyMeasurement(input);
  let row=measurementHistory(repo.getSnapshot(),member.id)[0];
  assert.equal(row.body_fat_percent,25);
  assert.throws(()=>repo.saveBodyMeasurement(input),/already/);
  const edit={...input,id:row.id,expected_updated_at:row.updated_at,weight_kg:'75',fat_mass_kg:'15'};
  repo.saveBodyMeasurement(edit);
  assert.throws(()=>repo.saveBodyMeasurement(edit),/changed/);
  row=measurementHistory(repo.getSnapshot(),member.id)[0];
  assert.equal(row.body_fat_percent,20);
  assert.throws(()=>repo.deleteBodyMeasurement({...edit,member_id:'unknown'}),/Member not found/);
  repo.deleteBodyMeasurement({...edit,expected_updated_at:row.updated_at});
  assert.equal(measurementHistory(repo.getSnapshot(),member.id).length,0);
  assert.equal(repo.getSnapshot().body_measurements.length,1);
  assert.ok(repo.getSnapshot().body_measurements[0].deleted_at);
  repo.saveBodyMeasurement(input);
  assert.notEqual(measurementHistory(repo.getSnapshot(),member.id)[0].id,row.id);
  const audit=repo.getSnapshot().audit_events.filter(event=>event.action.startsWith('measurement.'));
  assert.equal(audit.length,4);
  assert.equal(audit.find(event=>event.action==='measurement.delete').changes.before.body_fat_percent,20);
  repo.reload(); assert.equal(measurementHistory(repo.getSnapshot(),member.id).length,1);
});

test('measurements reject incomplete, invalid, future and excessive-precision entries atomically',()=>{
  const {repo,input}=setup(); const before=repo.getSnapshot();
  for(const patch of [{weight_kg:0},{weight_kg:-1},{weight_kg:''},{weight_kg:null},{weight_kg:Infinity},{fat_mass_kg:81},{skeletal_muscle_kg:81},{fat_mass_kg:'20.001'},{weight_kg:1001},{measurement_month:'2026-13-01'},{measurement_month:'2026-11-01'},{measurement_month:'2026-10-02'},{skeletal_muscle_kg:undefined}]) assert.throws(()=>repo.saveBodyMeasurement({...input,...patch}));
  assert.deepEqual(repo.getSnapshot(),before);
  assert.equal(validateMeasurement({...input,fat_mass_kg:0},'2026-10-28').body_fat_percent,0);
  assert.equal(bodyFatPercent(18.32,70.55),25.97);
  assert.equal(bodyFatPercent(1,0),null);
  const invalid=setup('unknown'); assert.throws(()=>invalid.repo.saveBodyMeasurement(invalid.input),/authorized/);
});

test('month ownership, archival, migration and missing-month trends preserve existing records',()=>{
  const {repo,input,member,storage}=setup();
  const legacy=repo.getSnapshot(); delete legacy.body_measurements; storage.setItem(STORAGE_KEY,JSON.stringify(legacy));
  repo.reload(); repo.saveBodyMeasurement({...input,measurement_month:'2026-08-01'});
  repo.saveBodyMeasurement(input);
  const row=measurementHistory(repo.getSnapshot(),member.id)[0];
  assert.throws(()=>repo.saveBodyMeasurement({...input,id:row.id,expected_updated_at:row.updated_at}),/original month/);
  const series=measurementSeries(measurementHistory(repo.getSnapshot(),member.id));
  assert.equal(series.length,3); assert.equal(series[1].weight_kg,null);
  assert.equal(measurementSeries(measurementHistory(repo.getSnapshot(),member.id),2).length,2);
  repo.archiveMember(member.id);
  assert.throws(()=>repo.saveBodyMeasurement({...input,measurement_month:'2026-09-01'}),/Restore/);
  assert.equal(measurementHistory(repo.getSnapshot(),member.id).length,2);
});

test('measurement export includes only recorded active rows in selected months and current categories',()=>{
  const data=createEmptyData();
  data.members=[{id:'a',member_code:'C001',full_name:'=Literal name',category_id:'customer'},{id:'b',member_code:'E001',full_name:'Staff fixture',category_id:'staff'},{id:'c',member_code:'C002',full_name:'Unmeasured',category_id:'customer'}];
  const base={weight_kg:80,fat_mass_kg:20,skeletal_muscle_kg:32,body_fat_percent:999};
  data.body_measurements=[{...base,id:'1',member_id:'a',measurement_month:'2026-10-01'},{...base,id:'2',member_id:'a',measurement_month:'2026-09-01'},{...base,id:'3',member_id:'b',measurement_month:'2026-10-01'},{...base,id:'4',member_id:'a',measurement_month:'2026-08-01',deleted_at:'2026-10-01'}];
  const scope={start:'2026-10-15',end:'2026-10-28',category:'customer'};
  const tables=exportTables(data,scope); const rows=tables.at(-1).rows;
  assert.equal(tables.length,6); assert.equal(rows.length,1); assert.equal(rows[0][0],'C001');
  assert.equal(rows[0][3],'10/2026'); assert.deepEqual(rows[0][7],{formula:'ROUND(F2/E2*100,2)',value:25});
  assert.equal(tables.at(-1).headers[4],'Weight (lb)');
  assert.equal(rows[0][4],kgToLb(80));
  assert.equal(rows[0][5],kgToLb(20));
  assert.equal(exportTables(data,{start:'2026-08-01',end:'2026-10-28'}).at(-1).rows.length,3);
  const zip=unzipSync(createPrototypeWorkbook(data,scope)); const xml=strFromU8(zip['xl/worksheets/sheet6.xml']);
  assert.match(xml,/<f>ROUND\(F2\/E2\*100,2\)<\/f><v>25<\/v>/);
  assert.match(xml,/t="inlineStr"[^>]*><is><t xml:space="preserve">=Literal name/);
  assert.match(xml,/xSplit="3" ySplit="1"/);
  assert.match(strFromU8(zip['xl/styles.xml']),/0.00&quot;%&quot;/);
});

test('pounds round trip exactly while untouched legacy kg values and percentages stay unchanged',()=>{
  const {repo,input,member}=setup();
  repo.saveBodyMeasurement(input);
  let row=measurementHistory(repo.getSnapshot(),member.id)[0];
  assert.deepEqual(measurementInputs(row),{weight_lb:'176.37',fat_mass_lb:'44.09',skeletal_muscle_lb:'70.55'});
  const edit={...measurementInputs(row),measurement_unit:'lb',member_id:member.id,measurement_month:row.measurement_month,id:row.id,expected_updated_at:row.updated_at};
  repo.saveBodyMeasurement(edit);
  row=measurementHistory(repo.getSnapshot(),member.id)[0];
  assert.equal(row.weight_kg,80);assert.equal(row.fat_mass_kg,20);assert.equal(row.skeletal_muscle_kg,32);assert.equal(row.body_fat_percent,25);
  repo.saveBodyMeasurement({...edit,expected_updated_at:row.updated_at,weight_lb:'180.01'});
  row=measurementHistory(repo.getSnapshot(),member.id)[0];
  assert.equal(row.weight_kg,81.6511625237);assert.equal(row.fat_mass_kg,20);assert.equal(row.skeletal_muscle_kg,32);
  assert.equal(measurementInputs(row).weight_lb,'180.01');
  for(const value of [0.01,0.1,123.45,180.01,2204.62]) assert.equal(Number(kgToLb(lbToKg(value)).toFixed(2)),value);
  const base={measurement_unit:'lb',measurement_month:'2026-09-01',weight_lb:'180',fat_mass_lb:'36',skeletal_muscle_lb:'70'};
  assert.equal(validateMeasurement(base,'2026-10-28').body_fat_percent,20);
  for(const patch of [{measurement_unit:'stone'},{weight_lb:0},{weight_lb:2204.63},{weight_lb:'180.001'},{fat_mass_lb:181},{weight_kg:80},{skeletal_muscle_lb:null}]) assert.throws(()=>validateMeasurement({...base,...patch},'2026-10-28'));
  assert.throws(()=>validateMeasurement({...input,weight_lb:180},'2026-10-28'),/one measurement unit/);
});

test('measurement profile deep links preserve normal profile routes',()=>{
  assert.equal(memberPath('abc','measurements'),'/members/abc/measurements');
  assert.deepEqual(resolveRoute('/members/abc/measurements/'),{page:'members',memberId:'abc',profileTab:'measurements',path:'/members/abc/measurements'});
  assert.equal(resolveRoute('/members/abc').profileTab,undefined);
  assert.equal(resolveRoute('/members/abc/wrong').page,'not-found');
});

test('measurement Edge commands use verified actors and reject unknown roles',async()=>{
  let role='admin',calls=0;
  const query={select(){return this;},eq(){return this;},is(){return this;},async maybeSingle(){return {data:{id:'staff',role_code:role}};}};
  const handler=createCommandHandler({userClient:()=>({auth:{getUser:async()=>({data:{user:{id:'verified'}}})},from:()=>query}),adminClient:()=>({rpc:async(name,args)=>{calls++;assert.equal(name,'gym_body_measurement');assert.equal(args.actor_auth_id,'verified');return {data:{measurement_id:'saved'}};}})});
  const invoke=command=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({command,request_id:crypto.randomUUID(),payload:{actor_auth_id:'forged'}})}));
  assert.equal((await invoke('measurement.save')).status,200);
  role='super_admin';assert.equal((await invoke('measurement.delete')).status,200);
  role='unknown';assert.equal((await invoke('measurement.save')).status,403);assert.equal(calls,2);
});
