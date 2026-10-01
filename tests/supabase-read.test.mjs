import test from 'node:test';
import assert from 'node:assert/strict';
import { readAll, normalizeSnapshot, loadLiveData, COLUMNS } from '../src/supabase/readData.js';
import { endDate, membershipStatus, findMembers } from '../src/prototype/domain.js';
import { membershipActivity } from '../src/prototype/insights.js';

test('read adapter paginates beyond a server page and propagates partial-page failures', async () => {
  const values = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const calls = [];
  const client = { from: table => ({ select: () => ({ order: order => ({ range: async (start, end) => {
    calls.push([table, order, start, end]); return { data: values.slice(start, end + 1), error: null };
  } }) }) }) };
  assert.equal((await readAll(client, 'members', 'id')).length, 1203);
  assert.deepEqual(calls.map(r => r[2]), [0, 500, 1000]);
  calls.length = 0;
  await readAll(client, 'member_codes', 'code');
  assert.equal(calls[0][1], 'code');
  const broken = { from: () => ({ select: () => ({ order: () => ({ range: async () => ({ error: { message: 'denied' } }) }) }) }) };
  await assert.rejects(() => readAll(broken, 'members', 'id'), /denied/);
});

test('live normalization preserves aliases and source expiry without inventing dates', () => {
  const data = normalizeSnapshot({ members: [{ id: 'p', full_name: 'Synthetic Guest', member_code: 'G001', category_id: 'guest' }], member_codes: [{ member_id: 'p', code: 'G01', retired_at: '2026-09-30' }], memberships: [] });
  assert.equal(findMembers(data, 'G01')[0].id, 'p');
  const row = { start_date: '2026-07-01', calculated_end_date: '2026-08-01', source_end_date: '2026-10-05' };
  assert.equal(endDate(row), '2026-10-05');
  assert.equal(endDate({ ...row, override_end_date: '2026-10-06' }), '2026-10-06');
  assert.equal(membershipStatus(row, '2026-10-01'), 'Active');
  assert.equal(membershipStatus({ ...row, start_date: null }, '2026-10-01'), 'Unknown');
  assert.ok(Object.values(COLUMNS).every(columns => !columns.includes('source_reference')));
});

test('import timestamps do not create false New/Renew activity', () => {
  const data = normalizeSnapshot({ memberships: [{ id: 'a', member_id: 'p', record_origin: 'import', created_at: '2026-10-01T06:00:00Z' }, { id: 'b', member_id: 'q', record_origin: 'live', created_at: '2026-10-01T06:00:00Z' }] });
  assert.deepEqual(membershipActivity(data, '2026-10-01').map(r => r.id), ['b']);
});

test('no session or enabled staff profile blocks all business reads', async () => {
  await assert.rejects(() => loadLiveData({ auth: { getUser: async () => ({ data: {}, error: null }) } }), /sign in/);
  const touched = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'unregistered' } } }) }, from: table => {
    touched.push(table);
    const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => ({ data: null }) };
    return query;
  } };
  await assert.rejects(() => loadLiveData(client), /enabled staff/);
  assert.deepEqual(touched, ['app_staff']);
});
