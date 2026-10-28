import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { startDatabase, root } from '../local/runtime.mjs';

test('measurement SQL enforces RLS, service access, monthly uniqueness, stale edits and auditable deletion',async()=>{
  const local=await startDatabase(); await local.end();
  const config=JSON.parse(await readFile(`${root}/connection.json`,'utf8'));
  const suffix=crypto.randomUUID().replaceAll('-',''),database=`gym_measurements_${suffix}`;
  const roles={anon:`anon_${suffix}`,authenticated:`authenticated_${suffix}`,service_role:`service_${suffix}`};
  const admin=new pg.Client({...config,database:'postgres'}); await admin.connect();
  let pool;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    for(const [name,role] of Object.entries(roles)) await admin.query(`CREATE ROLE ${role}${name==='service_role'?' BYPASSRLS':''}`);
    pool=new pg.Pool({...config,database});
    await pool.query(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA auth TO ${roles.authenticated};`);
    for(const file of ['20260929094219_community_fitness_foundation.sql','20261001040433_admin_provisioning_and_attendance_import.sql','20261001104539_live_workspace_commands.sql','20261001105350_admin_account_removal.sql','20261028083327_monthly_body_measurements.sql']) {
      const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');
      await pool.query(sql.replace(/\b(anon|authenticated|service_role)\b/g,name=>roles[name]));
    }
    const owner=crypto.randomUUID(),staff=crypto.randomUUID(),outsider=crypto.randomUUID();
    await pool.query('INSERT INTO auth.users VALUES ($1),($2),($3)',[owner,staff,outsider]);
    await pool.query("INSERT INTO public.app_staff(user_id,display_name,role_code,enabled) VALUES ($1,'Owner','super_admin',true),($2,'Staff','admin',true)",[owner,staff]);
    const member=(await pool.query("SELECT public.gym_command($1,$2,'member.save',$3) result",[owner,crypto.randomUUID(),{full_name:'Measurement fixture',category_id:'customer'}])).rows[0].result.member_id;
    const other=(await pool.query("SELECT public.gym_command($1,$2,'member.save',$3) result",[owner,crypto.randomUUID(),{full_name:'Different fixture',category_id:'customer'}])).rows[0].result.member_id;
    const asRole=async(role,operation,identity='')=>{
      const db=await pool.connect();
      try {await db.query(`SET ROLE ${role}`);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[identity]);return await operation(db);}
      finally {await db.query('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");db.release();}
    };
    const invoke=(payload,actor=staff,request=crypto.randomUUID(),command='measurement.save',role=roles.service_role)=>asRole(role,db=>db.query('SELECT public.gym_body_measurement($1,$2,$3,$4) result',[actor,request,command,payload]));
    const input={member_id:member,measurement_month:'2026-01-01',weight_kg:80,fat_mass_kg:20,skeletal_muscle_kg:32,body_fat_percent:999};
    const all=async()=>(await pool.query('SELECT to_jsonb(b) row FROM public.body_measurements b ORDER BY created_at')).rows.map(row=>row.row);
    await assert.rejects(invoke(input,owner,crypto.randomUUID(),'measurement.save',roles.anon),{code:'42501'});
    await assert.rejects(invoke(input,owner,crypto.randomUUID(),'measurement.save',roles.authenticated),{code:'42501'});
    await assert.rejects(invoke(input,outsider),{code:'42501'});
    for(const patch of [{measurement_month:'2999-01-01'},{measurement_month:'2026-01-02'},{weight_kg:0},{weight_kg:null},{fat_mass_kg:81},{skeletal_muscle_kg:-1},{weight_kg:'1.123'},{fat_mass_kg:'NaN'}]) await assert.rejects(invoke({...input,...patch}));
    assert.equal((await all()).length,0);
    const request=crypto.randomUUID();
    const results=await Promise.all([invoke(input,staff,request),invoke(input,staff,request)]);
    assert.deepEqual(results[0].rows,results[1].rows);
    let row=(await all())[0];assert.equal(row.body_fat_percent,25);
    const oldRow=structuredClone(row);
    const precisionSql=await readFile(new URL('../../supabase/migrations/20261028104605_measurement_pounds_precision.sql',import.meta.url),'utf8');
    await pool.query(precisionSql.replace(/\b(anon|authenticated|service_role)\b/g,name=>roles[name]));
    assert.deepEqual((await all())[0],oldRow);
    const pounds={member_id:member,measurement_month:row.measurement_month,measurement_unit:'lb',weight_lb:'176.37',fat_mass_lb:'44.09',skeletal_muscle_lb:'70.55',id:row.id,expected_updated_at:row.updated_at};
    await invoke(pounds);
    row=(await all())[0];assert.equal(row.weight_kg,80);assert.equal(row.fat_mass_kg,20);assert.equal(row.skeletal_muscle_kg,32);
    const poundInput={...pounds,measurement_month:'2026-05-01',id:null,expected_updated_at:null,weight_lb:'180.01',fat_mass_lb:'36',skeletal_muscle_lb:'70'};
    await invoke(poundInput);
    const poundRow=(await all()).find(item=>item.measurement_month==='2026-05-01');
    assert.equal(poundRow.weight_kg,81.6511625237);assert.equal(poundRow.fat_mass_kg,16.32932532);
    for(const patch of [{weight_lb:0},{weight_lb:2204.63},{fat_mass_lb:181},{skeletal_muscle_lb:-1},{measurement_unit:'stone'},{weight_lb:'180.001'},{weight_kg:80}]) await assert.rejects(invoke({...poundInput,measurement_month:'2026-06-01',...patch}));
    await invoke({member_id:member,id:poundRow.id,expected_updated_at:poundRow.updated_at},staff,crypto.randomUUID(),'measurement.delete');
    await assert.rejects(invoke(input),/already/);
    await assert.rejects(invoke({...input,fat_mass_kg:19},staff,request),/different operation/);
    for(const identity of [owner,staff]) {
      const visible=await asRole(roles.authenticated,db=>db.query('SELECT * FROM public.body_measurements'),identity);
      assert.equal(visible.rows.length,1);
      await assert.rejects(asRole(roles.authenticated,db=>db.query('DELETE FROM public.body_measurements'),identity),{code:'42501'});
      await assert.rejects(asRole(roles.authenticated,db=>db.query('UPDATE public.body_measurements SET weight_kg=90'),identity),{code:'42501'});
    }
    assert.equal((await asRole(roles.authenticated,db=>db.query('SELECT * FROM public.body_measurements'),outsider)).rows.length,0);
    const edit={...input,id:row.id,expected_updated_at:row.updated_at,weight_kg:75,fat_mass_kg:15};
    await assert.rejects(invoke({...edit,member_id:other}),/changed/);
    await assert.rejects(invoke({...edit,measurement_month:'2026-02-01'}),/original month/);
    const concurrent=await Promise.allSettled([invoke(edit,owner),invoke(edit,staff)]);
    assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
    row=(await all())[0];assert.equal(row.body_fat_percent,20);
    const remove={member_id:member,id:row.id,expected_updated_at:row.updated_at};
    await invoke(remove,owner,crypto.randomUUID(),'measurement.delete');
    assert.equal((await asRole(roles.authenticated,db=>db.query('SELECT * FROM public.body_measurements'),staff)).rows.length,0);
    const deleted=(await all())[0];assert.ok(deleted.deleted_at);assert.equal(deleted.body_fat_percent,20);
    await assert.rejects(invoke(edit),/changed/);
    await invoke(input);
    assert.equal((await all()).length,3);
    const audit=(await pool.query("SELECT changes FROM public.audit_events WHERE action='measurement.delete' AND entity_id=$1",[row.id])).rows[0];
    assert.equal(audit.changes.before.body_fat_percent,20);assert.ok(audit.changes.after.deleted_at);
    const simultaneous=await Promise.allSettled([invoke({...input,measurement_month:'2026-03-01'}),invoke({...input,measurement_month:'2026-03-01'},owner)]);
    assert.equal(simultaneous.filter(result=>result.status==='fulfilled').length,1);
    await pool.query('UPDATE public.members SET archived_at=now() WHERE id=$1',[member]);
    await assert.rejects(invoke({...input,measurement_month:'2026-04-01'}),/Restore/);
    await pool.query('UPDATE public.app_staff SET enabled=false WHERE user_id=$1',[staff]);
    await assert.rejects(invoke(input,staff,request),{code:'42501'});
    assert.equal((await asRole(roles.authenticated,db=>db.query('SELECT * FROM public.body_measurements'),staff)).rows.length,0);
  } finally {
    await pool?.end();await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    for(const role of Object.values(roles)) await admin.query(`DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
});
