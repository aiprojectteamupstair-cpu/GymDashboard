export const TIME_ZONE = 'Asia/Rangoon';

export function localDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function addMonths(date, months) {
  if (!validDate(date) || !Number.isInteger(months) || months < 1) return null;
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function shiftDays(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function formatDate(value, options = {}) {
  if (!validDate(value)) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC', ...options }).format(new Date(`${value}T00:00:00Z`));
}

export function parseDisplayDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  return validDate(iso) ? iso : '';
}

export function formatAttendanceTime(row) {
  if (!row.checked_in_at || row.time_source === 'import_date_only') return 'Time not recorded';
  return `${formatTime(row.checked_in_at)}${row.time_source === 'import_assumed' ? ' (assumed)' : ''}`;
}

export function formatTime(value) {
  if (!value || Number.isNaN(new Date(value).valueOf())) return 'Time not recorded';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value));
}

export function endDate(membership) {
  return membership?.override_end_date || membership?.source_end_date || membership?.calculated_end_date || null;
}

export function membershipStatus(membership, today = localDate()) {
  if (!membership || membership.voided_at || !membership.start_date || !endDate(membership)) return 'Unknown';
  if (membership.start_date > today) return 'Upcoming';
  if (endDate(membership) === today) return 'Ends today';
  return endDate(membership) > today ? 'Active' : 'Expired';
}

export function currentMembership(data, memberId, today = localDate()) {
  const priority = { Active: 0, 'Ends today': 1, Upcoming: 2, Expired: 3, Unknown: 4 };
  return data.memberships.filter(m => m.member_id === memberId && !m.voided_at).sort((a, b) => {
    const state = priority[membershipStatus(a, today)] - priority[membershipStatus(b, today)];
    if (state) return state;
    if (membershipStatus(a, today) === 'Upcoming') return a.start_date.localeCompare(b.start_date);
    return (endDate(b) || '').localeCompare(endDate(a) || '');
  })[0] || null;
}

export function categoryLabel(data, member) {
  return data.member_categories.find(c => c.id === member?.category_id)?.label || 'Unknown';
}

export function findMembers(data, query = '', category = 'all', archived = false) {
  const needle = query.trim().toLocaleLowerCase();
  return data.members.filter(m => Boolean(m.archived_at) === archived && (category === 'all' || m.category_id === category) &&
    [m.full_name, m.member_code, m.contact_phone, m.student_id, ...(m.previous_codes || [])].some(v => (v || '').toLocaleLowerCase().includes(needle)));
}

export function guestStatus(data, member, today = localDate()) {
  const firstVisit = data.attendance.filter(a => a.member_id === member.id && !a.voided_at).map(a => a.attendance_date).sort()[0];
  return firstVisit ? (firstVisit === today ? 'Trial today' : 'Trial used') : 'Trial available';
}

export function attendanceInPeriod(data, start, end) {
  return data.attendance.filter(a => !a.voided_at && a.attendance_date >= start && a.attendance_date <= end);
}

export function attendanceSeries(data, today, days = 14) {
  const counts = new Map();
  for (const row of data.attendance) if (!row.voided_at) counts.set(row.attendance_date, (counts.get(row.attendance_date) || 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDays(today, i - days + 1);
    return { date, label: formatDate(date, { day: '2-digit', month: 'short', year: undefined }), visits: counts.get(date) || 0 };
  });
}

export function ageOn(dob, today = localDate()) {
  if (!validDate(dob)) return null;
  const [y, m, d] = today.split('-').map(Number);
  const [by, bm, bd] = dob.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
