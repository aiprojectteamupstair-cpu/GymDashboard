import { addMonths, attendanceInPeriod, currentMembership, endDate, formatDate, localDate, membershipStatus, shiftDays, TIME_ZONE } from './domain.js';

export const isStaffVisit = row => ['Staff', 'Staff/Employee'].includes(row.member_category_snapshot);

export function calendarPeriod(month, staff = false) {
  const start = `${month}-${staff ? '25' : '01'}`;
  const end = staff ? addMonths(start, 1) : shiftDays(addMonths(start, 1), -1);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  return { start, end, days, dates: Array.from({ length: days }, (_, i) => shiftDays(start, i)) };
}

export function currentStaffMonth(today) {
  return today.slice(8) >= '25' ? today.slice(0, 7) : shiftDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
}

export function membershipActivity(data, today) {
  return data.memberships.filter(m => m.record_origin !== 'import' && !m.voided_at && m.created_at && localDate(m.created_at) === today).map(m => ({
    ...m, activity_kind: m.transaction_kind || (data.memberships.some(h => h.member_id === m.member_id && h.id !== m.id && !h.voided_at && h.created_at < m.created_at) ? 'Renew' : 'New')
  })).sort((a,b)=>b.created_at.localeCompare(a.created_at));
}
export function dashboardGroups(data, today) {
  const members = data.members.filter(m => !m.archived_at);
  const active = members.filter(m => membershipStatus(currentMembership(data, m.id, today), today) === 'Active');
  const expiring = members.filter(m => {
    const record = currentMembership(data, m.id, today);
    return record?.start_date <= today && endDate(record) >= today && endDate(record) <= shiftDays(today, 14);
  });
  const lastVisits = new Map();
  for (const row of data.attendance) {
    if (!row.voided_at && row.attendance_date <= today && (!lastVisits.has(row.member_id) || lastVisits.get(row.member_id) < row.attendance_date)) lastVisits.set(row.member_id, row.attendance_date);
  }
  const engagement = active.map(m => {
    const last_visit = lastVisits.get(m.id) || null;
    return { ...m, last_visit, days_since_visit: last_visit ? Math.round((Date.parse(today) - Date.parse(last_visit)) / 86400000) : null };
  });
  return { members, active: engagement, quiet10: engagement.filter(m => m.days_since_visit >= 10 && m.days_since_visit <= 20), quiet20: engagement.filter(m => m.days_since_visit > 20), unvisited: engagement.filter(m => m.last_visit === null), expiring, activity: membershipActivity(data,today), arrivals: attendanceInPeriod(data, today, today) };
}

function summarize(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.member_id, (counts.get(row.member_id) || 0) + 1);
  const unique = counts.size;
  const repeat = [...counts.values()].filter(n => n >= 2).length;
  return { visits: rows.length, unique, average: unique ? rows.length / unique : null, repeat, repeatRate: unique ? repeat / unique * 100 : null };
}

export function attendanceInsights(data, start, end, category = 'all') {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days < 1 || days > 366) throw new Error('Choose an attendance period of 1–366 days.');
  const previousEnd = shiftDays(start, -1);
  const previousStart = shiftDays(start, -days);
  const label = data.member_categories.find(c => c.id === category)?.label;
  const seen = new Set();
  const valid = [...data.attendance].filter(a => !a.voided_at && (category === 'all' || (category === 'staff' ? isStaffVisit(a) : a.member_category_snapshot === label))).sort((a, b) => (a.checked_in_at || a.attendance_date).localeCompare(b.checked_in_at || b.attendance_date)).filter(a => {
    const key = `${a.member_id}/${a.attendance_date}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const rows = valid.filter(a => a.attendance_date >= start && a.attendance_date <= end);
  const previousRows = valid.filter(a => a.attendance_date >= previousStart && a.attendance_date <= previousEnd);
  const counts = new Map();
  for (const a of valid) counts.set(a.attendance_date, (counts.get(a.attendance_date) || 0) + 1);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => ({ name, visits: 0, occurrences: 0, average: 0 }));
  const hours = Array.from({ length: 24 }, (_, h) => ({ name: `${String(h).padStart(2, '0')}:00`, visits: 0 }));
  const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });
  const series = Array.from({ length: days }, (_, i) => {
    const date = shiftDays(start, i);
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    weekdays[weekday].occurrences++;
    weekdays[weekday].visits += counts.get(date) || 0;
    return { date, label: formatDate(date, { year: undefined }), visits: counts.get(date) || 0, previous: counts.get(shiftDays(previousStart, i)) || 0 };
  });
  const timedRows = rows.filter(a => a.checked_in_at && !['import_assumed', 'import_date_only'].includes(a.time_source));
  for (const a of timedRows) hours[Number(hourFormat.format(new Date(a.checked_in_at)))].visits++;
  for (const day of weekdays) day.average = day.occurrences ? day.visits / day.occurrences : 0;
  return { ...summarize(rows), previous: summarize(previousRows), rows, series, weekdays, hours, unknownTimeVisits: rows.length - timedRows.length, start, end, previousStart, previousEnd, days };
}

export function quietMembers(data, today) {
  const start = shiftDays(today, -13);
  const seen = new Set(attendanceInPeriod(data, start, today).map(a => a.member_id));
  return dashboardGroups(data, today).active.filter(m => m.category_id !== 'guest' && !seen.has(m.id)).map(m => {
    const last = data.attendance.filter(a => a.member_id === m.id && !a.voided_at && a.attendance_date <= today).map(a => a.attendance_date).sort().at(-1);
    return { ...m, last_visit: last || null };
  });
}

export function deltaLabel(current, previous) {
  if (!previous) return current ? 'No visits in previous period' : 'No change from previous period';
  const percent = (current - previous) / previous * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(0)}% vs previous period`;
}
