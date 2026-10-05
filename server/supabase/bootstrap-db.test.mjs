import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { startDatabase, root } from '../local/runtime.mjs';

test('owner bootstrap SQL is atomic, idempotent, service-only and preserves disabled/existing staff', async () => {
  const local = await startDatabase(); await local.end();
  const config = JSON.parse(await readFile(`${root}/connection.json`, 'utf8'));
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const database = `gym_bootstrap_${suffix}`;
  const roles = { anon: `anon_${suffix}`, authenticated: `authenticated_${suffix}`, service_role: `service_${suffix}` };
  const admin = new pg.Client({ ...config, database: 'postgres' }); await admin.connect();
  let pool;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    for (const role of Object.values(roles)) await admin.query(`CREATE ROLE ${role}`);
    pool = new pg.Pool({ ...config, database });
    await pool.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
      CREATE TABLE public.app_staff(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE REFERENCES auth.users(id),display_name text,role_code text,enabled boolean,deleted_at timestamptz,updated_at timestamptz DEFAULT now());
      ALTER TABLE public.app_staff ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.audit_events(actor_user_id uuid,actor_name text,entity_type text,entity_id text,action text,changes jsonb,reason text);`);
    let sql = await readFile(new URL('../../supabase/migrations/20261005030000_super_admin_bootstrap.sql', import.meta.url), 'utf8');
    sql = sql.replace(/\b(anon|authenticated|service_role)\b/g, name => roles[name]);
    await pool.query(sql);
    const id = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    await pool.query("INSERT INTO auth.users VALUES ($1,'owner@example.test',now(),null,null),($2,'other@example.test',now(),null,null)", [id, other]);
    const seeded = await pool.query("INSERT INTO public.app_staff(display_name,role_code,enabled) VALUES ('Prepared owner','super_admin',false) RETURNING id");
    const invoke = async (target = id, email = 'owner@example.test', role = roles.service_role) => {
      const db = await pool.connect();
      try {
        await db.query(`SET ROLE ${role}`);
        return await db.query('SELECT public.bootstrap_super_admin_staff($1,$2) AS id', [target, email]);
      } finally { await db.query('RESET ROLE'); db.release(); }
    };
    await assert.rejects(invoke(id, 'owner@example.test', roles.anon), { code: '42501' });
    await assert.rejects(invoke(id, 'owner@example.test', roles.authenticated), { code: '42501' });
    const linked = await Promise.all([invoke(), invoke()]);
    assert.ok(linked.every(result => result.rows[0].id === seeded.rows[0].id));
    assert.equal((await pool.query('SELECT count(*) FROM public.audit_events')).rows[0].count, '1');
    await assert.rejects(invoke(other, 'other@example.test'), { code: '42501' });
    await assert.rejects(invoke(id, 'other@example.test'), { code: '42501' });
    await pool.query('UPDATE public.app_staff SET enabled=false');
    await assert.rejects(invoke(), { code: '42501' });
    await pool.query('TRUNCATE public.app_staff,public.audit_events');
    await pool.query("INSERT INTO public.app_staff(user_id,display_name,role_code,enabled) VALUES ($1,'Existing admin','admin',true)", [id]);
    await assert.rejects(invoke(), { code: '42501' });
    await pool.query('TRUNCATE public.app_staff');
    await pool.query('UPDATE auth.users SET banned_until=now()+interval \'1 day\' WHERE id=$1', [id]);
    await assert.rejects(invoke(), { code: '42501' });
    await pool.query('UPDATE auth.users SET banned_until=null WHERE id=$1', [id]);
    await pool.query('UPDATE auth.users SET deleted_at=now() WHERE id=$1', [id]);
    await assert.rejects(invoke(), { code: '42501' });
    await pool.query('UPDATE auth.users SET deleted_at=null,email_confirmed_at=null WHERE id=$1', [id]);
    await assert.rejects(invoke(), { code: '42501' });
    await pool.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [id]);
    await invoke();
    assert.equal((await pool.query('SELECT count(*) FROM public.app_staff')).rows[0].count, '1');
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    for (const role of Object.values(roles)) await admin.query(`DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
});
