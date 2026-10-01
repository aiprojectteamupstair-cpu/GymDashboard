import { useState } from 'react';
import { Button, EmptyState, Panel } from './components.jsx';
import { formatDate, formatTime, formatAttendanceTime } from './domain.js';
export function AttendanceHistory({rows,onEditAttendance}) {
  const [page,setPage]=useState(1);
  const pages=Math.max(1,Math.ceil(rows.length/8)), current=Math.min(page,pages);
  return <Panel title="Attendance history"><div className="table-scroll"><table className="member-table"><thead><tr><th>Date</th><th>Check-in time</th><th>Action</th></tr></thead><tbody>{rows.slice((current-1)*8,current*8).map(row=><tr key={row.id}><td>{formatDate(row.attendance_date)}</td><td>{formatAttendanceTime(row)}{row.original_checked_in_at && <small>Corrected</small>}</td><td><Button onClick={()=>onEditAttendance(row)}>Edit time</Button></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="No recorded visits" message="Check-ins will appear here."/>}<div className="table-footer"><span>{rows.length} visits · Page {current} of {pages}</span><div><Button disabled={current===1} onClick={()=>setPage(current-1)}>Previous</Button><Button disabled={current===pages} onClick={()=>setPage(current+1)}>Next</Button></div></div></Panel>;
}
