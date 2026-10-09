import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CalendarCheck2 } from 'lucide-react';
import { Button, Panel } from './components.jsx';
import { addMonths, formatDate, shiftDays } from './domain.js';
import { calendarPeriod, isStaffVisit } from './insights.js';

export function AttendanceCalendar({ data, member, today, onManageAttendance }) {
  const staff = member.category_id === 'staff';
  const [month, setMonth] = useState(() => {
    const latest = data.attendance.filter(row => row.member_id === member.id && !row.voided_at).map(row => row.attendance_date).sort().at(-1) || today;
    return latest.slice(0, 7);
  });
  const period = calendarPeriod(month);
  const visits = data.attendance.filter(a => a.member_id === member.id && !a.voided_at && a.attendance_date >= period.start && a.attendance_date <= period.end && (!staff || isStaffVisit(a)));
  const visitDates = new Set(visits.map(a => a.attendance_date));
  const offset = (new Date(`${period.start}T00:00:00Z`).getUTCDay() + 6) % 7;
  function move(direction) {
    setMonth(direction > 0 ? addMonths(`${month}-01`, 1).slice(0, 7) : shiftDays(`${month}-01`, -1).slice(0, 7));
  }
  return <Panel title="Monthly attendance" subtitle={`${visitDates.size} visits · ${formatDate(period.start)} – ${formatDate(period.end)}`} action={<div className="calendar-controls"><Button aria-label="Previous attendance period" onClick={() => move(-1)}><ChevronLeft size={17} /></Button><input type="month" aria-label="Profile attendance month" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} /><Button aria-label="Next attendance period" onClick={() => move(1)}><ChevronRight size={17} /></Button></div>}>
    <div className="attendance-calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{period.dates.map(date => <div key={date} className={`calendar-day ${visitDates.has(date) ? 'visited' : ''} ${date === today ? 'is-today' : ''} ${date > today ? 'future' : ''}`} aria-label={`${date}: ${visitDates.has(date) ? 'Checked in' : 'No check-in recorded'}`}><span>{Number(date.slice(8))}</span>{visitDates.has(date) && <Check size={17} />}</div>)}</div>
    <div className="calendar-legend"><span><i />Checked in</span><span>Blank = no recorded visit</span>{onManageAttendance && <Button onClick={() => onManageAttendance(member.id, month)}><CalendarCheck2 size={16} />Edit attendance</Button>}</div>
  </Panel>;
}
