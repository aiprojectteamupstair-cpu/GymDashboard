import { categoryLabel, localDate, validDate } from './domain.js';

export function attendanceVersion(row) {
  return row ? { id: row.id, updated_at: row.updated_at || null, checked_in_at: row.checked_in_at || null, voided_at: row.voided_at || null } : null;
}

export function applyAttendanceCalendar(data, input, actor, now) {
  if (actor?.role !== 'super_admin') throw new Error('Only Admin can edit the attendance calendar.');
  const member = data.members.find(row => row.id === input.member_id);
  if (!member) throw new Error('Member not found.');
  const reason = input.reason?.trim();
  if (!reason || reason.length > 500) throw new Error('Enter a correction reason of 1-500 characters.');
  if (!Array.isArray(input.changes) || !input.changes.length || input.changes.length > 32) throw new Error('Choose 1-32 attendance dates.');
  const dates = new Set();
  const before = [], after = [];
  for (const change of input.changes) {
    const date = change.date;
    if (!validDate(date) || date >= localDate(now)) throw new Error('Choose a past Myanmar calendar date.');
    if (dates.has(date)) throw new Error('Each date may only appear once.');
    dates.add(date);
    if (typeof change.present !== 'boolean') throw new Error('Choose a valid attendance status.');
    let row = data.attendance.find(item => item.member_id === member.id && item.attendance_date === date);
    const version = attendanceVersion(row);
    if (!Object.hasOwn(change, 'expected') || (version ? !change.expected || Object.keys(version).some(key => version[key] !== change.expected[key]) : change.expected !== null)) throw new Error('Attendance changed. Refresh and reopen the calendar.');
    before.push(row ? structuredClone(row) : null);
    if (!change.present) {
      if (!row || row.voided_at) throw new Error('No recorded visit to remove.');
      row.voided_at = now; row.void_reason = reason;
    } else {
      if (change.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(change.time)) throw new Error('Enter a valid check-in time.');
      if (!row && !change.time) throw new Error('Enter a check-in time for each new visit.');
      const timestamp = change.time ? new Date(`${date}T${change.time}:00+06:30`).toISOString() : row.checked_in_at;
      if (!row) {
        row = { id:crypto.randomUUID(), member_id:member.id, membership_id:null, attendance_date:date,
          checked_in_at:timestamp, recorded_at:now, record_origin:'live', time_source:'manual',
          checked_in_by:actor.id, member_code_snapshot:member.member_code, member_category_snapshot:categoryLabel(data,member), voided_at:null };
        data.attendance.push(row);
      } else {
        if (change.time && timestamp !== row.checked_in_at) {
          row.original_checked_in_at ||= row.checked_in_at;
          row.checked_in_at = timestamp; row.time_source = 'manual';
        }
        row.voided_at = null; row.void_reason = null;
      }
    }
    row.updated_at = now; row.updated_by = actor.id; row.correction_reason = reason;
    after.push(structuredClone(row));
  }
  return { entity_type:'members', entity_id:member.id, reason, changes:{ before, after }, count:after.length };
}
