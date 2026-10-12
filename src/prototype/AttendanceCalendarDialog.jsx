import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Save, Undo2 } from 'lucide-react';
import { Button, Dialog, Field } from './components.jsx';
import { addMonths, shiftDays, formatDate, formatAttendanceTime } from './domain.js';
import { calendarPeriod } from './insights.js';
import { attendanceVersion } from './attendanceCalendarService.js';

export function AttendanceCalendarDialog({ data, member, today, initialMonth, onClose, onSave }) {
  const [month, setMonth] = useState(initialMonth || today.slice(0, 7));
  const [changes, setChanges] = useState({});
  const [selectedDate, setSelectedDate] = useState('');
  const period = calendarPeriod(month);
  const rows = data.attendance.filter(row => row.member_id === member.id);
  const offset = (new Date(`${period.start}T00:00:00Z`).getUTCDay() + 6) % 7;
  const pending = Object.values(changes).sort((a, b) => a.date.localeCompare(b.date));
  const selected = changes[selectedDate] || pending.at(-1);
  const selectedRow = selected && rows.find(row => row.attendance_date === selected.date);
  function toggle(date) {
    setSelectedDate(date);
    setChanges(current => {
      const next = { ...current };
      if (next[date]) delete next[date];
      else {
        const row = rows.find(item => item.attendance_date === date);
        next[date] = { date, present: !row || Boolean(row.voided_at), expected: attendanceVersion(row) };
      }
      return next;
    });
  }
  const move = direction => setMonth(direction > 0 ? addMonths(`${month}-01`, 1).slice(0, 7) : shiftDays(`${month}-01`, -1).slice(0, 7));
  return <Dialog title="Edit attendance" subtitle={`${member.full_name} · ${member.member_code}`} onClose={onClose} wide className="attendance-dialog">
    <form onSubmit={event => { event.preventDefault(); if (pending.length) onSave({ member_id: member.id, changes: pending }); }}>
      <div className="dialog-body attendance-editor">
        <div className="calendar-toolbar">
          <div className="calendar-controls"><Button type="button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={18}/></Button><input type="month" aria-label="Attendance month" value={month} max={today.slice(0, 7)} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value) && event.target.value <= today.slice(0, 7)) setMonth(event.target.value); }}/><Button type="button" aria-label="Next month" disabled={period.end >= today} onClick={() => move(1)}><ChevronRight size={18}/></Button></div>
          <span className="soft-note">Myanmar time</span>
        </div>
        <div className="attendance-calendar editable-calendar" style={{ '--calendar-weeks': Math.ceil((offset + period.dates.length) / 7) }}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="calendar-weekday">{day}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`}/>)}{period.dates.map(date => {
          const row = rows.find(item => item.attendance_date === date);
          const present = changes[date]?.present ?? Boolean(row && !row.voided_at);
          return <button type="button" key={date} disabled={date >= today} aria-pressed={present} aria-label={`${date}: ${present ? 'Present' : 'No recorded visit'}`} className={`calendar-day ${present ? 'visited' : ''} ${changes[date] ? 'pending-change' : ''}`} onClick={() => toggle(date)}><span>{Number(date.slice(8))}</span>{present && <Check size={16}/>}</button>;
        })}</div>
        <div className="calendar-legend"><span><i/>Present</span><span>Blank: no recorded visit</span><span className="pending-legend">Unsaved change</span></div>
        <div className="calendar-change-row">
          <Field label="Changed date"><select disabled={!selected} value={selected?.date || ''} onChange={event => setSelectedDate(event.target.value)}>{!selected && <option value="">No changes</option>}{pending.map(change => <option key={change.date} value={change.date}>{formatDate(change.date)} · {change.present ? 'Present' : 'Remove visit'}</option>)}</select></Field>
          {selected?.present && !selectedRow ? <Field label="Check-in time (optional)"><input type="time" value={selected.time || ''} onChange={event => setChanges(current => ({ ...current, [selected.date]: { ...current[selected.date], time: event.target.value } }))}/></Field> : <div className="calendar-change-status soft-note">{selected ? selected.present ? formatAttendanceTime(selectedRow) : 'Remove recorded visit' : ''}</div>}
          <Button type="button" disabled={!selected} aria-label="Undo selected change" title="Undo selected change" onClick={() => setChanges(current => { const next = { ...current }; delete next[selected.date]; return next; })}><Undo2 size={16}/></Button>
        </div>
      </div>
      <div className="dialog-footer"><span className="soft-note">{pending.length} date{pending.length === 1 ? '' : 's'} changed</span><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!pending.length}><Save size={16}/>Save changes</Button></div>
    </form>
  </Dialog>;
}
