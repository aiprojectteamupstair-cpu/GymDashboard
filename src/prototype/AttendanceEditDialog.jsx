import { useState } from 'react';
import { Button, Dialog, Field } from './components.jsx';
import { formatDate, formatTime, localDate, TIME_ZONE } from './domain.js';

export function AttendanceEditDialog({data, row, onClose, onSave}) {
  const [time,setTime] = useState(() => new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(row.checked_in_at)));
  const [reason,setReason] = useState('');
  const [error,setError] = useState('');
  const member = data.members.find(m=>m.id===row.member_id);
  const history = data.audit_events.filter(a=>a.entity_id===row.id && ['attendance.time_corrected','attendance.time'].includes(a.action) && a.changes?.before?.checked_in_at && a.changes?.after?.checked_in_at);
  return <Dialog title="Edit check-in time" subtitle={member?.full_name || 'Attendance record'} onClose={onClose}>
    <form onSubmit={e=>{e.preventDefault();try {onSave({time,reason,expected_checked_in_at:row.checked_in_at});}catch(err){setError(err.message);}}}>
      <div className="dialog-body">
        <p className="previous-membership">{formatDate(row.attendance_date)} · Current time: {formatTime(row.checked_in_at)}<br/>Myanmar time. The attendance date and daily presence stay unchanged.</p>
        <div className="form-grid">
          <Field label="Check-in time *"><input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></Field>
          <Field label="Correction reason *" className="span-two"><textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {history.length>0 && <details className="correction-history"><summary>Previous time corrections ({history.length})</summary>{history.map(a=><p key={a.id}>{formatTime(a.changes.before.checked_in_at)} → {formatTime(a.changes.after.checked_in_at)} · {a.reason}<br/><small>{formatDate(localDate(a.occurred_at))} · {a.actor_name || data.app_staff.find(s=>s.user_id===a.actor_user_id)?.display_name || 'Admin'}</small></p>)}</details>}
      </div>
      <div className="dialog-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save time</Button></div>
    </form>
  </Dialog>;
}
