import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Save, Undo2 } from 'lucide-react';
import { Button, Dialog, Field } from './components.jsx';
import { addMonths, shiftDays, formatDate, formatAttendanceTime } from './domain.js';
import { calendarPeriod } from './insights.js';
import { attendanceVersion } from './attendanceCalendarService.js';

export function AttendanceCalendarDialog({ data, member, today, initialMonth, onClose, onSave }) {
  const [month, setMonth] = useState(initialMonth || today.slice(0, 7));
  const [changes, setChanges] = useState({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const period = calendarPeriod(month, member.category_id === 'staff');
  const rows = data.attendance.filter(row => row.member_id === member.id);
  const offset = (new Date(`${period.start}T00:00:00Z`).getUTCDay() + 6) % 7;
  const pending = Object.values(changes).sort((a,b) => a.date.localeCompare(b.date));
  function toggle(date) {
    setChanges(current => {
      const next = { ...current };
      if (next[date]) delete next[date];
      else {
        const row = rows.find(item => item.attendance_date === date);
        next[date] = { date, present:!row || Boolean(row.voided_at), expected:attendanceVersion(row), ...(!row ? { time:'' } : {}) };
      }
      return next;
    });
  }
  function changeTime(date, time) {
    const row = rows.find(item => item.attendance_date === date);
    setChanges(current => ({ ...current, [date]: { date, present:true, expected:attendanceVersion(row), ...current[date], time } }));
  }
  const move = direction => setMonth(direction > 0 ? addMonths(`${month}-01`,1).slice(0,7) : shiftDays(`${month}-01`,-1).slice(0,7));
  return <Dialog title="Edit attendance" subtitle={`${member.full_name} · ${member.member_code}`} onClose={onClose} wide>
    <form onSubmit={event => { event.preventDefault(); setError(''); if (!pending.length) return; if (pending.some(row => row.present && row.time === '')) { setError('Enter a check-in time for each new visit.'); return; } onSave({member_id:member.id,reason,changes:pending}); }}>
      <div className="dialog-body attendance-editor">
        <div className="calendar-controls"><Button type="button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={18}/></Button><input type="month" aria-label="Attendance month" value={month} max={today.slice(0,7)} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }}/><Button type="button" aria-label="Next month" disabled={period.end >= today} onClick={() => move(1)}><ChevronRight size={18}/></Button></div>
        <p className="soft-note">{formatDate(period.start)} – {formatDate(period.end)} · Myanmar time</p>
        <div className="attendance-calendar editable-calendar">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day} className="calendar-weekday">{day}</span>)}{Array.from({length:offset},(_,index) => <span key={`blank-${index}`}/>)}{period.dates.map(date => {
          const row = rows.find(item => item.attendance_date === date);
          const present = changes[date]?.present ?? Boolean(row && !row.voided_at);
          return <button type="button" key={date} disabled={date >= today} aria-pressed={present} aria-label={`${date}: ${present ? 'Present' : 'No recorded visit'}`} className={`calendar-day ${present ? 'visited' : ''} ${changes[date] ? 'pending-change' : ''}`} onClick={() => toggle(date)}><span>{Number(date.slice(8))}</span>{present && <Check size={18}/>}</button>;
        })}</div>
        <div className="calendar-legend"><span><i/>Present</span><span>Blank: no recorded visit</span><span className="pending-legend">Unsaved change</span></div>
        <div className="attendance-date-edits">{pending.map(change => {
          const row = rows.find(item => item.attendance_date === change.date);
          return <div className="attendance-date-edit" key={change.date}><div><strong>{formatDate(change.date)}</strong><small>{change.present ? row?.voided_at ? 'Restore visit' : row ? 'Correct time' : 'Add visit' : 'Remove recorded visit'}</small></div>{change.present && <Field label="Check-in time"><input type="time" required={!row} value={change.time ?? ''} onChange={event => changeTime(change.date,event.target.value)} />{ /* Existing imported times remain unchanged unless explicitly entered. */ }</Field>}{change.present && row && change.time === undefined && <small>{formatAttendanceTime(row)} (kept)</small>}<Button type="button" aria-label={`Undo ${change.date}`} title="Undo change" onClick={() => setChanges(current => { const next={...current}; delete next[change.date]; return next; })}><Undo2 size={16}/></Button></div>;
        })}</div>
        <details className="calendar-time-details"><summary>Correct an existing visit's time</summary>{rows.filter(row => !row.voided_at && row.attendance_date >= period.start && row.attendance_date <= period.end && row.attendance_date < today && !changes[row.attendance_date]).sort((a,b)=>a.attendance_date.localeCompare(b.attendance_date)).map(row => <div className="attendance-date-edit" key={row.id}><span>{formatDate(row.attendance_date)} · {formatAttendanceTime(row)}</span><Button type="button" onClick={() => setChanges(current => ({...current,[row.attendance_date]:{date:row.attendance_date,present:true,expected:attendanceVersion(row),time:''}}))}>Edit time</Button></div>)}</details>
        <Field label="Reason for changes"><textarea required maxLength={500} value={reason} onChange={event => setReason(event.target.value)}/></Field>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div><div className="dialog-footer"><span className="soft-note">{pending.length} date{pending.length === 1 ? '' : 's'} changed</span><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!pending.length || !reason.trim()}><Save size={16}/>Save changes</Button></div>
    </form>
  </Dialog>;
}
