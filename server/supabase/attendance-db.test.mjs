import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { startDatabase, root } from '../local/runtime.mjs';
import { attendanceVersion } from '../../src/prototype/attendanceCalendarService.js';

test('calendar SQL: real schema, service-only access, Admin permission, concurrency, rollback and history', async () => {
  const local=await startDatabase(); await local.end();
  const config=JSON.parse(await readFile(`${root}/connection.json`,'utf8'));
  const suffix=crypto.randomUUID().replaceAll('-','');
  const database=`gym_calendar_${suffix}`;
  const roles={anon:`anon_${suffix}`,authenticated:`authenticated_${suffix}`,service_role:`service_${suffix}`};
  const admin=new pg.Client({...config,database:'postgres'}); await admin.connect();
  let pool;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    for(const [name,role] of Object.entries(roles)) await admin.query(`CREATE ROLE ${role}${name==='service_role'?' BYPASSRLS':''}`);
    pool=new pg.Pool({...config,database});
    await pool.query(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT null::uuid';`);
    for(const file of ['20260929094219_community_fitness_foundation.sql','20261001040433_admin_provisioning_and_attendance_import.sql','20261001104539_live_workspace_commands.sql','20261001105350_admin_account_removal.sql','20261005084758_admin_attendance_calendar.sql']) {
      const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');
      await pool.query(sql.replace(/\b(anon|authenticated|service_role)\b/g,name=>roles[name]));
    }
    const owner=crypto.randomUUID(),staff=crypto.randomUUID();
    await pool.query('INSERT INTO auth.users VALUES ($1),($2)',[owner,staff]);
    await pool.query("INSERT INTO public.app_staff(user_id,display_name,role_code,enabled) VALUES ($1,'Owner','super_admin',true),($2,'Reception','admin',true)",[owner,staff]);
    const member=(await pool.query("SELECT public.gym_command($1,$2,'member.save',$3) AS result",[owner,crypto.randomUUID(),{full_name:'Calendar fixture',category_id:'guest'}])).rows[0].result.member_id;
    const input=changes=>({member_id:member,reason:'Verified reception register',changes});
    const add={date:'2026-01-02',present:true,time:'09:15',expected:null};
    const invoke=async (payload,actor=owner,id=crypto.randomUUID(),role=roles.service_role)=>{
      const db=await pool.connect();
      try { await db.query(`SET ROLE ${role}`); return (await db.query('SELECT public.gym_attendance_calendar($1,$2,$3) AS result',[actor,id,payload])).rows[0].result; }
      finally { await db.query('RESET ROLE'); db.release(); }
    };
    const row=async()=> (await pool.query('SELECT to_jsonb(a) AS row FROM public.attendance a WHERE member_id=$1 AND attendance_date=$2',[member,add.date])).rows[0]?.row;
    await assert.rejects(invoke(input([add]),owner,crypto.randomUUID(),roles.anon),{code:'42501'});
    await assert.rejects(invoke(input([add]),owner,crypto.randomUUID(),roles.authenticated),{code:'42501'});
    await assert.rejects(invoke(input([add]),staff),{code:'42501'});
    await assert.rejects(invoke(input([{...add,date:'2999-01-01'}])),/past/);
    await assert.rejects(invoke({...input([add]),reason:''}),/reason/);
    await assert.rejects(invoke(input([{...add,time:undefined}])),/time/);
    await assert.rejects(invoke(input([add,add])),/once/);
    assert.equal(await row(),undefined);
    const request=crypto.randomUUID();
    const results=await Promise.all([invoke(input([add]),owner,request),invoke(input([add]),owner,request)]);
    assert.deepEqual(results[0],results[1]);
    const original=await row();
    assert.ok(original.recorded_at.startsWith(new Date().getUTCFullYear().toString()));
    const edit=input([{date:add.date,present:true,time:'10:00',expected:attendanceVersion(original)}]);
    const concurrent=await Promise.allSettled([invoke(edit),invoke(edit)]);
    assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
    let current=await row();
    assert.equal(current.original_checked_in_at,original.checked_in_at);
    const snapshot=current;
    await assert.rejects(invoke(input([{...add,date:'2026-01-03'},{...add,expected:null}])),/changed/);
    assert.equal((await pool.query('SELECT count(*) FROM public.attendance')).rows[0].count,'1');
    assert.deepEqual(await row(),snapshot);
    await invoke(input([{date:add.date,present:false,expected:attendanceVersion(current)}]));
    current=await row(); assert.ok(current.voided_at);
    await invoke(input([{date:add.date,present:true,expected:attendanceVersion(current)}]));
    current=await row(); assert.equal(current.id,original.id); assert.equal(current.voided_at,null);
    assert.equal(current.original_checked_in_at,original.checked_in_at);
    assert.equal((await pool.query("SELECT count(*) FROM public.audit_events WHERE action='attendance.calendar'")).rows[0].count,'4');
    await pool.query('UPDATE public.app_staff SET enabled=false WHERE user_id=$1',[owner]);
    await assert.rejects(invoke(input([add]),owner,request),{code:'42501'});
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    for(const role of Object.values(roles)) await admin.query(`DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
});
