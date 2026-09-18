import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { addMonths, currentMembership, localDate, membershipStatus } from '../src/prototype/domain.js';
import { createDemoData } from '../src/prototype/demoData.js';
import { createPrototypeRepository, STORAGE_KEY, TABLE_NAMES } from '../src/prototype/repository.js';
import { createPrototypeWorkbook, exportTables } from '../src/prototype/export.js';

const now = new Date('2026-09-18T06:30:00.000Z');
function memoryStorage() {
  const store = new Map();
  return { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
}
function setup() {
  const storage = memoryStorage();
  return { storage, repository: createPrototypeRepository(storage, () => now) };
}
const newMember = { full_name: 'Test Member', category_id: 'student', contact_phone: '001234', date_of_birth: '', student_id: 'DEMO-001', remark: '' };

test('calendar addition clips once in the target month, including leap years', () => {
  for (const [start, months, expected] of [
    ['2026-01-31', 1, '2026-02-28'], ['2026-01-31', 3, '2026-04-30'],
    ['2028-01-31', 1, '2028-02-29'], ['2028-02-29', 12, '2029-02-28'],
    ['2026-07-15', 3, '2026-10-15'], ['2026-11-30', 3, '2027-02-28'],
  ]) assert.equal(addMonths(start, months), expected);
  assert.equal(addMonths('2026-02-31', 3), null);
  assert.equal(addMonths('2026-01-01', null), null);
});

test('Myanmar attendance date changes at Myanmar midnight, not UTC midnight', () => {
  assert.equal(localDate('2026-09-17T17:29:59Z'), '2026-09-17');
  assert.equal(localDate('2026-09-17T17:30:00Z'), '2026-09-18');
});

test('end date today stays distinct from active/expired while policy is pending', () => {
  const membership = { start_date: '2026-09-01', calculated_end_date: '2026-09-18' };
  assert.equal(membershipStatus(membership, '2026-09-18'), 'Ends today');
  assert.equal(membershipStatus(membership, '2026-09-19'), 'Expired');
  assert.equal(membershipStatus(membership, '2026-09-17'), 'Active');
});

test('prototype preserves eight collections and names never serve as identity', () => {
  const { repository } = setup();
  assert.deepEqual(Object.keys(repository.getSnapshot()).sort(), [...TABLE_NAMES].sort());
  const a = repository.saveMember(newMember).member;
  const b = repository.saveMember(newMember).member;
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.member_code, b.member_code);
  assert.equal(a.contact_phone, '001234');
});

test('check-in retries and a second adapter return the original daily record', () => {
  const { repository, storage } = setup();
  const member = repository.saveMember(newMember).member;
  const first = repository.checkIn(member.id, true);
  const second = createPrototypeRepository(storage, () => new Date('2026-09-18T07:00:00Z'));
  const retry = second.checkIn(member.id, true);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.attendance.id, first.attendance.id);
  assert.equal(retry.attendance.checked_in_at, first.attendance.checked_in_at);
  assert.equal(second.getSnapshot().attendance.filter(a => a.member_id === member.id).length, 1);
});

test('manual expiry requires a reason and unknown duration is not inferred', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  const base = { member_id: member.id, package_id: 'student-day', start_date: '2026-09-18' };
  assert.throws(() => repository.addMembership(base), /no confirmed duration/);
  assert.throws(() => repository.addMembership({ ...base, override_end_date: '2026-10-18' }), /reason/);
  assert.throws(() => repository.addMembership({ ...base, override_end_date: '2026-09-17', override_reason: 'Test' }), /on or after/);
  const { membership } = repository.addMembership({ ...base, override_end_date: '2026-10-18', override_reason: 'Sample explicit date' });
  assert.equal(membership.calculated_end_date, null);
  assert.equal(membership.payment_method_id, null);
  assert.equal(membership.overridden_by, 'demo-admin');
  assert.equal(repository.getSnapshot().audit_events[0].reason, 'Sample explicit date');
});

test('new/renew preserves snapshots, manual override and previous records', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  const input = { member_id: member.id, package_id: 'september', start_date: '2026-07-15', override_end_date: '2026-10-20', override_reason: 'Reviewed date' };
  const original = repository.addMembership(input).membership;
  assert.equal(original.calculated_end_date, '2026-10-15');
  assert.equal(original.override_end_date, '2026-10-20');
  repository.addMembership({ ...input, start_date: '2026-10-21', override_end_date: '', override_reason: '' });
  repository.saveMember({ ...newMember, category_id: 'customer' }, member.id);
  const memberships = repository.getSnapshot().memberships.filter(m => m.member_id === member.id);
  assert.equal(memberships.length, 2);
  assert.equal(memberships.find(m => m.id === original.id).member_category_snapshot, 'Student');
  assert.equal(currentMembership(repository.getSnapshot(), member.id, '2026-09-18').id, original.id);
});

test('archive keeps memberships/attendance and restore re-enables check-in', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  repository.addMembership({ member_id: member.id, package_id: 'september', start_date: '2026-09-01' });
  repository.checkIn(member.id, true);
  repository.archiveMember(member.id);
  assert.throws(() => repository.checkIn(member.id, true), /archived/);
  assert.equal(repository.getSnapshot().attendance.filter(a => a.member_id === member.id).length, 1);
  assert.equal(repository.getSnapshot().memberships.filter(m => m.member_id === member.id).length, 1);
  repository.archiveMember(member.id, false);
  assert.equal(repository.checkIn(member.id, true).duplicate, true);
});

test('failed persistence does not report success or change the in-memory snapshot', () => {
  const { repository, storage } = setup();
  const snapshot = repository.getSnapshot();
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => repository.saveMember(newMember), /Storage full/);
  assert.equal(repository.getSnapshot(), snapshot);
});

test('corrupt saved data is not silently replaced, and explicit reset recovers', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{broken');
  const repository = createPrototypeRepository(storage, () => now);
  assert.ok(repository.getError());
  assert.throws(() => repository.saveMember(newMember));
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
  repository.reset();
  assert.equal(repository.getError(), '');
  assert.ok(repository.getSnapshot().members.length);
});

test('filtered export reconciles attendees and preserves all their membership history', () => {
  const data = createDemoData('2026-09-18', now);
  const tables = exportTables(data, { start: '2026-09-18', end: '2026-09-18' });
  const members = tables.find(t => t.name === 'Members');
  const attendance = tables.find(t => t.name === 'Attendance');
  const expected = data.attendance.filter(a => a.attendance_date === '2026-09-18');
  assert.equal(attendance.rows.length, expected.length);
  assert.equal(members.rows.length, new Set(expected.map(a => a.member_id)).size);
  const codes = new Set(members.rows.map(r => r[0]));
  assert.ok(attendance.rows.every(r => codes.has(r[0])));
  assert.equal(tables.find(t => t.name === 'Memberships').rows.length, data.memberships.filter(m => expected.some(a => a.member_id === m.member_id)).length);
});

test('Excel export has four worksheets, typed dates, filters and literal input text', () => {
  const data = createDemoData('2026-09-18', now);
  data.members[0].full_name = '=HYPERLINK("invalid") & <test>';
  const zip = unzipSync(createPrototypeWorkbook(data));
  const workbook = strFromU8(zip['xl/workbook.xml']);
  assert.equal((workbook.match(/<sheet /g) || []).length, 4);
  const members = strFromU8(zip['xl/worksheets/sheet2.xml']);
  assert.ok(members.includes('=HYPERLINK(&quot;invalid&quot;) &amp; &lt;test&gt;'));
  assert.ok(!members.includes('<f>'));
  assert.ok(members.includes('<autoFilter'));
  assert.ok(members.includes('s="3"><v>'));
  assert.ok(strFromU8(zip['xl/styles.xml']).includes('yyyy-mm-dd'));
});
