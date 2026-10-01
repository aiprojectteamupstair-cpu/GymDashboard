import { shiftDays } from './domain.js';
export function attendanceCoverage(data) {
  const dates = data.attendance.filter(row => !row.voided_at).map(row => row.attendance_date).sort();
  return { count: dates.length, first: dates[0] || null, last: dates.at(-1) || null };
}
export function initialAnalysisPeriod(data, today) {
  const last = attendanceCoverage(data).last;
  const end = last && last < today ? last : shiftDays(today, -1);
  return { start: last && last < today ? `${end.slice(0, 7)}-01` : shiftDays(today, -30), end };
}
