import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrototypeRepository, STORAGE_KEY, RELEASE_BACKUP_KEY } from '../src/prototype/repository.js';
import { createDemoData } from '../src/prototype/demoData.js';
import { createEmptyData, retireLocalFixtures, DATA_RELEASE } from '../src/prototype/dataLifecycle.js';

const now = () => new Date('2026-09-30T06:30:00Z');
const store = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };
const guest = (id, code) => ({ id, member_code: code, previous_codes: [], full_name: 'Retained Test Guest', category_id: 'guest' });

test('new local workspaces and explicit reset contain catalogues, never fixture people', () => {
  const storage = store(), repo = createPrototypeRepository(storage, now);
  for (const table of ['members', 'memberships', 'attendance', 'training_purchases', 'app_staff', 'payment_methods']) assert.equal(repo.getSnapshot()[table].length, 0);
  assert.deepEqual(repo.getSnapshot().packages.map(p => p.label), ['Gym', 'Swimming Pool Only']);
  assert.equal(repo.getSnapshot().member_categories.find(c => c.id === 'guest').digits, 3);
  assert.equal(repo.saveMember({ full_name: 'New Test Guest', category_id: 'guest' }).member.member_code, 'G001');
  assert.equal(createPrototypeRepository(storage, now).getSnapshot().members.length, 1);
  repo.reset();
  assert.equal(createPrototypeRepository(storage, now).getSnapshot().members.length, 0);
});

test('fixture retirement backs up exact bytes, preserves real histories and removes old catalogue rows', () => {
  const storage = store(), source = createDemoData('2026-09-30', now());
  source.members.push(guest('user-person', 'G72'));
  source.packages.push({ id: 'legacy-plan', label: 'Historical Test Package', enabled: false, legacy: true });
  source.memberships.push({ id: 'user-membership', member_id: 'user-person', package_id: 'legacy-plan', source_end_date: '2026-08-01' });
  source.attendance.push({ id: 'user-visit', member_id: 'user-person', attendance_date: '2026-07-01', member_code_snapshot: 'G72' });
  source.training_purchases.push({ id: 'fixture-training', member_id: 'demo-member-1' }, { id: 'user-pt', member_id: 'user-person' });
  source.audit_events.push({ id: 'fixture-audit', entity_id: 'demo-member-1' }, { id: 'user-audit', entity_id: 'user-person' });
  const raw = JSON.stringify(source);
  storage.setItem(STORAGE_KEY, raw);
  storage.setItem('community-fitness:local-accounts:v1', 'do-not-touch');
  const repo = createPrototypeRepository(storage, now), data = repo.getSnapshot();
  assert.equal(repo.getError(), '');
  assert.equal(storage.getItem(RELEASE_BACKUP_KEY), raw);
  assert.equal(storage.getItem('community-fitness:local-accounts:v1'), 'do-not-touch');
  assert.equal(data.members.length, 1);
  assert.equal(data.members[0].member_code, 'G072');
  assert.deepEqual(data.members[0].previous_codes, ['G72']);
  assert.equal(data.memberships[0].package_snapshot.label, 'Historical Test Package');
  assert.equal(data.memberships[0].source_end_date, '2026-08-01');
  assert.deepEqual(data.packages.map(p => p.id), ['gym', 'pool']);
  assert.equal(data.attendance.length, 1);
  assert.equal(data.attendance[0].member_code_snapshot, 'G72');
  assert.equal(data.training_purchases.length, 1);
  assert.equal(data.audit_events.length, 1);
  assert.equal(data.data_release, DATA_RELEASE);
  const after = storage.getItem(STORAGE_KEY);
  assert.deepEqual(createPrototypeRepository(storage, now).getSnapshot(), data);
  assert.equal(storage.getItem(STORAGE_KEY), after);
  assert.equal(storage.getItem(RELEASE_BACKUP_KEY), raw);
  assert.equal(repo.saveMember({ full_name: 'Another Test Guest', category_id: 'guest' }).member.member_code, 'G073');
});

test('Guest normalization rejects collisions, including former ID ownership', () => {
  for (const extra of [guest('b', 'G001'), { ...guest('b', 'G09'), previous_codes: ['G001'] }]) {
    const source = createEmptyData(); delete source.data_release;
    source.members = [guest('a', 'G01'), extra];
    const original = structuredClone(source);
    assert.throws(() => retireLocalFixtures(source), /Conflicting Guest IDs/);
    assert.deepEqual(source, original);
  }
});

test('backup and migration write failures keep the old data intact and block further edits', () => {
  for (const failedKey of [RELEASE_BACKUP_KEY, STORAGE_KEY]) {
    const storage = store(), raw = JSON.stringify(createDemoData('2026-09-30', now()));
    storage.setItem(STORAGE_KEY, raw);
    const write = storage.setItem;
    storage.setItem = (key, value) => { if (key === failedKey) throw new Error('Storage full'); write(key, value); };
    const repo = createPrototypeRepository(storage, now);
    assert.match(repo.getError(), /Storage full/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.throws(() => repo.saveMember({ full_name: 'Do not save', category_id: 'guest' }), /Storage full/);
  }
});

test('empty local export does not fabricate member or attendance rows', async () => {
  const { exportTables } = await import('../src/prototype/export.js');
  const tables = exportTables(createEmptyData(), { start: '2026-09-01', end: '2026-09-30' });
  for (const name of ['Members', 'Memberships', 'Attendance', 'Training']) assert.equal(tables.find(t => t.name === name).rows.length, 0);
});
