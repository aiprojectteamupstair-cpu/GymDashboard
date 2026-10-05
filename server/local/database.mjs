import { readFile } from 'node:fs/promises';
import { createEmptyData } from '../../src/prototype/dataLifecycle.js';
import { TABLE_NAMES, STORAGE_KEY, createPrototypeRepository } from '../../src/prototype/repository.js';

export async function transaction(pool, operation) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Serialize domain changes, including category code allocation and account revocation.
    await db.query('SELECT pg_advisory_xact_lock(8200261002)');
    const result = await operation(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); }
}

export async function initializeDatabase(pool, seed) {
  await transaction(pool, async db => {
    await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    for (const name of TABLE_NAMES) {
      await db.query(`CREATE TABLE IF NOT EXISTS gym_local.${name} (id text PRIMARY KEY, data jsonb NOT NULL CHECK (data->>'id' = id))`);
    }
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS members_code ON gym_local.members ((data->>'member_code'));
      CREATE UNIQUE INDEX IF NOT EXISTS attendance_day ON gym_local.attendance ((data->>'member_id'), (data->>'attendance_date')) WHERE data->>'voided_at' IS NULL`);
    const { rows } = await db.query('SELECT version FROM gym_local.schema_version');
    if (!rows.length) {
      await saveSnapshot(db, createEmptyData());
      await db.query('INSERT INTO gym_local.schema_version(version) VALUES (1)');
    }
    const count = await db.query('SELECT count(*) FROM gym_local.accounts');
    if (Number(count.rows[0].count) === 0) {
      await db.query(`INSERT INTO gym_local.accounts (id, email, display_name, role_code, salt, password_hash)
        VALUES ($1,$2,'Super Admin','super_admin',$3,$4)`, [crypto.randomUUID(), seed.email, seed.salt, seed.hash]);
    }
  });
}

export async function loadSnapshot(db) {
  const data = createEmptyData();
  for (const name of TABLE_NAMES) data[name] = (await db.query(`SELECT data FROM gym_local.${name} ORDER BY id`)).rows.map(row => row.data);
  return data;
}

async function saveSnapshot(db, data) {
  for (const name of TABLE_NAMES) {
    // Domain records retain their exact historical snapshots; only changed rows are written.
    for (const row of data[name]) {
      await db.query(`INSERT INTO gym_local.${name} (id,data) VALUES ($1,$2::jsonb)
        ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data WHERE ${name}.data IS DISTINCT FROM EXCLUDED.data`, [row.id, JSON.stringify(row)]);
    }
  }
}

export async function runCommand(db, actor, command, payload, requestId) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId || '')) throw new Error('A valid request ID is required.');
  const fingerprint = JSON.stringify({ command, payload });
  const saved = (await db.query('SELECT * FROM gym_local.command_results WHERE request_id=$1', [requestId])).rows[0];
  if (saved) {
    if (saved.actor_id !== actor.id || saved.fingerprint !== fingerprint) throw new Error('Request ID already used for another operation.');
    return saved.result;
  }
  const data = await loadSnapshot(db);
  const storage = new Map([[STORAGE_KEY, JSON.stringify(data)]]);
  const repo = createPrototypeRepository({ getItem:key => storage.get(key) ?? null, setItem:(key,value) => storage.set(key,value) }, () => new Date(), () => ({ ...actor, role:actor.role_code }));
  const p = payload;
  const assertFresh = row => {
    if (!row || row.updated_at !== p.expected_updated_at) throw new Error('This record changed. Refresh and reopen it before editing.');
  };
  let result;
  switch (command) {
    case 'member.save':
      if (p.id) assertFresh(data.members.find(row => row.id === p.id));
      result = repo.saveMember(p, p.id); break;
    case 'member.archive':
      assertFresh(data.members.find(row => row.id === p.id));
      result = repo.archiveMember(p.id, p.archive); break;
    case 'membership.add': result = repo.addMembership(p); break;
    case 'attendance.checkin': result = repo.checkIn(p.id, p.acknowledged, p.time); break;
    case 'attendance.time': result = repo.updateAttendanceTime(p.id, p); break;
    case 'attendance.calendar': result = repo.editAttendanceCalendar(p); break;
    case 'catalogue.save': result = repo.saveCatalogue(p.kind, p, p.id); break;
    case 'catalogue.status':
      if (!['packages', 'discounts'].includes(p.kind)) throw new Error('Unknown catalogue.');
      assertFresh(data[p.kind].find(row => row.id === p.id));
      result = repo.setCatalogueStatus(p.kind, p.id, p.enabled); break;
    default: throw new Error('Unknown command.');
  }
  await saveSnapshot(db, repo.getSnapshot());
  await db.query('INSERT INTO gym_local.command_results(request_id,actor_id,fingerprint,result) VALUES ($1,$2,$3,$4)', [requestId,actor.id,fingerprint,JSON.stringify(result)]);
  return result;
}
