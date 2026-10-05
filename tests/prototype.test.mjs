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

test('workspace extends collections and names never serve as identity', () => {
  const { repository } = setup();
  assert.deepEqual(Object.keys(repository.getSnapshot()).filter(k => Array.isArray(repository.getSnapshot()[k])).sort(), [...TABLE_NAMES].sort());
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

test('manual expiry requires a reason; duration comes from a selected plan', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  const base = { member_id: member.id, package_id: 'gym', start_date: '2026-09-18' };
  assert.throws(() => repository.addMembership(base), /membership plan/);
  assert.throws(() => repository.addMembership({ ...base, plan_id: 'plan-1', override_end_date: '2026-10-18' }), /reason/);
  assert.throws(() => repository.addMembership({ ...base, plan_id: 'plan-1', override_end_date: '2026-09-17', override_reason: 'Test' }), /on or after/);
  const { membership } = repository.addMembership({ ...base, plan_id: 'plan-1', override_end_date: '2026-10-20', override_reason: 'Reviewed date' });
  assert.equal(membership.calculated_end_date, '2026-10-18');
  assert.equal(membership.payment_method_id, undefined, 'New memberships no longer collect payment methods');
  assert.equal(membership.overridden_by, 'demo-admin');
  assert.equal(repository.getSnapshot().audit_events[0].reason, 'Reviewed date');
});

test('new/renew preserves snapshots, manual override and previous records', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  const input = { member_id: member.id, package_id: 'gym', plan_id: 'plan-3', start_date: '2026-07-15', override_end_date: '2026-10-20', override_reason: 'Reviewed date' };
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
  repository.addMembership({ member_id: member.id, package_id: 'gym', plan_id: 'plan-3', start_date: '2026-09-01' });
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
  assert.equal(repository.getSnapshot().members.length, 0);
});

test('attendance matrix includes non-visitors and reconciles presence and history', () => {
  const data = createDemoData('2026-09-18', now);
  const tables = exportTables(data, { start: '2026-09-18', end: '2026-09-18' });
  const members = tables.find(t => t.name === 'Members');
  const attendance = tables.find(t => t.name === 'Attendance');
  const expected = data.attendance.filter(a => a.attendance_date === '2026-09-18');
  assert.equal(attendance.rows.length, data.members.length);
  assert.equal(attendance.rows.reduce((sum,row)=>sum+row[3],0),expected.length);
  assert.equal(members.rows.length, data.members.length);
  const codes = new Set(members.rows.map(r => r[0]));
  assert.ok(attendance.rows.every(r => codes.has(r[0])));
  assert.equal(tables.find(t => t.name === 'Memberships').rows.length, data.memberships.length);
});

test('Excel export has five worksheets, typed dates, filters and literal input text', () => {
  const data = createDemoData('2026-09-18', now);
  data.members[0].full_name = '=HYPERLINK("invalid") & <test>';
  const zip = unzipSync(createPrototypeWorkbook(data));
  const workbook = strFromU8(zip['xl/workbook.xml']);
  assert.equal((workbook.match(/<sheet /g) || []).length, 5);
  const members = strFromU8(zip['xl/worksheets/sheet2.xml']);
  assert.ok(members.includes('=HYPERLINK(&quot;invalid&quot;) &amp; &lt;test&gt;'));
  assert.ok(!members.includes('<f>'));
  assert.ok(members.includes('<autoFilter'));
  assert.ok(strFromU8(zip['xl/worksheets/sheet3.xml']).includes('s="3"><v>'));
  assert.ok(strFromU8(zip['xl/styles.xml']).includes('dd mmm yyyy'));
});

test('category codes use distinct sequences, retain former IDs and never reuse archived IDs', () => {
  const { repository } = setup();
  for (const [category, pattern] of [['vip', /^VC\d{2,}$/], ['customer', /^C\d{3,}$/], ['student', /^S\d{3,}$/], ['staff', /^E\d{3,}$/], ['guest', /^G\d{3,}$/]]) {
    const first = repository.saveMember({ ...newMember, category_id: category }).member;
    assert.match(first.member_code, pattern);
    repository.archiveMember(first.id);
    const second = repository.saveMember({ ...newMember, category_id: category }).member;
    assert.notEqual(first.member_code, second.member_code);
  }
});

test('guest conversion is atomic and preserves person, code and attendance history', () => {
  const { repository, storage } = setup();
  const guest = repository.saveMember({ ...newMember, category_id: 'guest' }).member;
  repository.checkIn(guest.id, true);
  assert.throws(() => repository.addMembership({ member_id: guest.id, package_id: 'gym', plan_id: 'plan-1', start_date: '2026-09-18' }), /Convert/);
  const conversion = { ...guest, category_id: 'vip', membership: { package_id: 'gym', plan_id: 'plan-1', discount_id: 'condo-50', start_date: '2026-09-18' } };
  const before = storage.getItem(STORAGE_KEY);
  assert.throws(() => repository.saveMember({ ...conversion, membership: { ...conversion.membership, plan_id: 'missing' } }, guest.id));
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.throws(() => repository.saveMember({ ...guest, category_id: 'vip' }, guest.id), /package and plan/);
  const converted = repository.saveMember(conversion, guest.id).member;
  assert.equal(converted.id, guest.id);
  assert.match(converted.member_code, /^VC/);
  assert.ok(converted.previous_codes.includes(guest.member_code));
  const attendance = repository.getSnapshot().attendance.find(a => a.member_id === guest.id);
  assert.equal(attendance.member_category_snapshot, 'Guest');
  assert.equal(attendance.member_code_snapshot, guest.member_code);
  assert.equal(repository.getSnapshot().memberships.find(m => m.member_id === guest.id).discount_snapshot.label, 'Condo 50%');
  assert.equal(repository.checkIn(guest.id, true).duplicate, true);
});

test('guest trial permits repeats on the same day but not another trial day', () => {
  const { repository, storage } = setup();
  const guest = repository.saveMember({ ...newMember, category_id: 'guest' }).member;
  repository.checkIn(guest.id, true);
  assert.equal(repository.checkIn(guest.id, true).duplicate, true);
  const tomorrow = createPrototypeRepository(storage, () => new Date('2026-09-19T06:30:00Z'));
  assert.throws(() => tomorrow.checkIn(guest.id, true), /one-day trial/);
});

test('Admin cannot edit catalogue details and snapshots survive status changes', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  const pack = repository.saveCatalogue('packages', { label: 'Gym Plus', allows_training: true, enabled: true, access_notes: 'Gym facilities' }).row;
  const discount = repository.saveCatalogue('discounts', { label: 'Welcome 15%', percentage: 15, enabled: true }).row;
  const input = { member_id: member.id, package_id: pack.id, plan_id: 'plan-6', discount_id: discount.id, start_date: '2026-01-31' };
  const original = repository.addMembership(input).membership;
  assert.equal(original.calculated_end_date, '2026-07-31');
  assert.throws(() => repository.saveCatalogue('packages', { ...pack, label: 'Updated Gym' }, pack.id), /Only Admin/);
  repository.setCatalogueStatus('packages', pack.id, false);
  assert.throws(() => repository.addMembership(input), /active package/);
  repository.setCatalogueStatus('packages', pack.id, true);
  repository.setCatalogueStatus('discounts', discount.id, false);
  assert.throws(() => repository.addMembership(input), /active discount/);
  const saved = repository.getSnapshot().memberships.find(m => m.id === original.id);
  assert.equal(saved.package_snapshot.label, 'Gym Plus');
  assert.equal(saved.discount_snapshot.percentage, 15);
  assert.throws(() => repository.saveCatalogue('discounts', { label: 'Invalid', percentage: 101, enabled: true }), /100/);
});

test('PT dates use the membership start and independent session validity', () => {
  const { repository } = setup();
  const member = repository.saveMember(newMember).member;
  for (const [sessions, expected] of [[5, '2026-02-28'], [10, '2026-02-28'], [20, '2026-03-31'], [50, '2026-06-30']]) {
    const result = repository.addMembership({ member_id: member.id, package_id: 'gym', plan_id: 'plan-12', start_date: '2026-01-31', training_type: sessions === 5 ? 'rehab' : 'pt', training_sessions: sessions });
    assert.equal(result.trainingPurchase.service_type, 'pt');
    assert.equal(result.trainingPurchase.start_date, result.membership.start_date);
    assert.equal(result.trainingPurchase.end_date, expected);
    assert.equal(result.membership.calculated_end_date, '2027-01-31');
  }
  const count = repository.getSnapshot().training_purchases.length;
  assert.throws(() => repository.addMembership({ member_id: member.id, package_id: 'pool', plan_id: 'plan-1', start_date: '2026-01-31', training_type: 'pt', training_sessions: 10 }), /eligible Gym/);
  assert.equal(repository.getSnapshot().training_purchases.length, count);
  repository.addMembership({ member_id: member.id, package_id: 'gym', plan_id: 'plan-1', start_date: '2026-01-31', training_type: 'none', training_sessions: 50 });
  assert.equal(repository.getSnapshot().training_purchases.length, count);
  const tables = exportTables(repository.getSnapshot());
  assert.equal(tables.find(t => t.name === 'Training').rows.length, 4);
});

test('legacy upgrade keeps a raw backup, identities, historical dates and unknown values', () => {
  const storage = memoryStorage();
  const old = createDemoData('2026-09-18', now);
  old.members[0].id = 'retained-person';
  old.memberships[0].member_id = 'retained-person';
  old.attendance.forEach(a => { if (a.member_id === 'demo-member-1') a.member_id = 'retained-person'; });
  delete old.schema_version; delete old.membership_plans; delete old.discounts; delete old.training_purchases;
  old.members[0].member_code = 'TCF-0001';
  old.members[0].category_id = 'customer';
  old.members.push({ ...old.members[0], id: 'unknown-person', member_code: 'TCF-0099', category_id: 'unknown' });
  old.member_categories.push({ id: 'unknown', label: 'Unknown', enabled: true });
  old.packages = [{ id: 'old-package', label: 'Sept Package', duration_months: 3, enabled: true }];
  old.memberships[0].package_id = 'old-package';
  old.memberships[0].package_snapshot = { ...old.packages[0] };
  old.memberships[0].calculated_end_date = '2026-09-01';
  const raw = JSON.stringify(old);
  storage.setItem(STORAGE_KEY, raw);
  const repository = createPrototypeRepository(storage, () => now);
  const data = repository.getSnapshot();
  assert.equal(data.members[0].id, old.members[0].id);
  assert.ok(data.members[0].previous_codes.includes('TCF-0001'));
  assert.equal(data.memberships[0].calculated_end_date, '2026-09-01');
  assert.deepEqual(data.packages.map(p => p.id), ['gym', 'pool']);
  assert.equal(data.memberships[0].package_snapshot.label, 'Sept Package');
  assert.equal(data.members.find(m => m.id === 'unknown-person').category_id, 'unknown');
  repository.saveMember(newMember);
  assert.equal(storage.getItem(STORAGE_KEY + ':before-concept-v2'), raw);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schema_version, 2);
});

test('Staff cycles include both 25ths and normal calendars remain separate', async () => {
  const { calendarPeriod, currentStaffMonth } = await import('../src/prototype/insights.js');
  const feb = calendarPeriod('2024-02', true), march = calendarPeriod('2024-03', true);
  assert.equal(feb.start, '2024-02-25'); assert.equal(feb.end, '2024-03-25');
  assert.equal(feb.days, 30); assert.ok(march.dates.includes(feb.end));
  assert.equal(calendarPeriod('2024-02').end, '2024-02-29');
  assert.equal(currentStaffMonth('2026-01-24'), '2025-12');
  assert.equal(currentStaffMonth('2026-01-25'), '2026-01');
});
test('attendance insights deduplicate, exclude voids, compare equal periods and use Myanmar hours', async () => {
  const { attendanceInsights } = await import('../src/prototype/insights.js');
  const row = (id, date, extra = {}) => ({ member_id:id, attendance_date:date, checked_in_at:date+'T00:00:00Z', member_category_snapshot:'Staff', ...extra });
  const data = { member_categories:[{id:'staff',label:'Staff/Employee'}], attendance:[
    row('a','2026-09-07'), row('a','2026-09-07'), row('a','2026-09-08'),
    row('b','2026-09-08'), row('c','2026-09-08',{voided_at:'yes'}), row('a','2026-08-31')
  ] };
  const result = attendanceInsights(data,'2026-09-07','2026-09-13','staff');
  assert.equal(result.visits,3); assert.equal(result.unique,2); assert.equal(result.average,1.5);
  assert.equal(result.repeatRate,50); assert.equal(result.previous.visits,1);
  assert.equal(result.hours[6].visits,3); assert.equal(result.weekdays[1].average,2);
  assert.equal(result.series.length,7);
  const empty = attendanceInsights({...data,attendance:[]},'2026-09-07','2026-09-13');
  assert.equal(empty.average,null); assert.equal(empty.repeatRate,null);
  const { exportTables } = await import('../src/prototype/export.js');
  const exported = exportTables({ ...data, members:[{id:'a',member_code:'E001',full_name:'A',category_id:'staff'},{id:'b',member_code:'E002',full_name:'B',category_id:'staff'},{id:'z',member_code:'E003',full_name:'Z',category_id:'staff'}], memberships:[], training_purchases:[] }, {start:'2026-09-07',end:'2026-09-13',category:'staff'});
  assert.equal(exported.find(t=>t.name==='Attendance').rows.flatMap(row=>row.slice(3)).reduce((a,b)=>a+b,0), result.visits);
  assert.ok(exported.find(t=>t.name==='Attendance').rows.find(row=>row[0]==='E003').slice(3).every(n=>n===0));
  assert.deepEqual(exported.slice(1).map(t=>t.headers.length), [8,10,10,6]);
});
test('time corrections preserve daily identity and original time with an audit trail', () => {
  const {repository} = setup();
  const person = repository.saveMember(newMember).member;
  const row = repository.checkIn(person.id, true).attendance;
  const original = row.checked_in_at;
  const count = repository.getSnapshot().attendance.length;
  repository.updateAttendanceTime(row.id,{time:'06:45',reason:'Reception time correction',expected_checked_in_at:original});
  const saved = repository.getSnapshot().attendance.find(a=>a.id===row.id);
  assert.equal(saved.checked_in_at,'2026-09-18T00:15:00.000Z');
  assert.equal(saved.original_checked_in_at,original);
  assert.equal(saved.attendance_date,row.attendance_date);
  assert.equal(repository.getSnapshot().attendance.length,count);
  const event=repository.getSnapshot().audit_events[0];
  assert.equal(event.changes.before.checked_in_at,original);
  assert.equal(event.reason,'Reception time correction');
  assert.throws(()=>repository.updateAttendanceTime(row.id,{time:'07:00',reason:'test',expected_checked_in_at:original}),/changed/);
  assert.throws(()=>repository.updateAttendanceTime(row.id,{time:'07:00',reason:'',expected_checked_in_at:saved.checked_in_at}),/Explain/);
  assert.throws(()=>repository.updateAttendanceTime(row.id,{time:'23:59',reason:'test',expected_checked_in_at:saved.checked_in_at}),/future/);
  assert.throws(()=>repository.updateAttendanceTime(row.id,{time:'25:00',reason:'test',expected_checked_in_at:saved.checked_in_at}),/valid/);
});
test('custom matrix includes every date across month and leap-day boundaries', () => {
  const data=createDemoData('2026-09-18',now);
  const table=exportTables(data,{start:'2024-02-28',end:'2024-03-01'}).find(t=>t.name==='Attendance');
  assert.deepEqual(table.headers.slice(3),['2024-02-28','2024-02-29','2024-03-01']);
  assert.ok(table.rows.every(row=>row.slice(3).every(n=>n===0)));
  assert.throws(()=>exportTables(data,{start:'2026-09-19',end:'2026-09-01'}),/period/);
});
