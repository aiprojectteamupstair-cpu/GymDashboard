import { MemberForm, MembershipForm, CheckInDialog, CatalogueForm } from '../prototype/forms.jsx';
import { AttendanceEditDialog } from '../prototype/AttendanceEditDialog.jsx';
import { AttendanceCalendarDialog } from '../prototype/AttendanceCalendarDialog.jsx';
import { Button, Dialog } from '../prototype/components.jsx';
import { MutationContext } from '../prototype/mutationContext.js';
import { monthLabel } from '../prototype/bodyMeasurements.js';
import { Trash2 } from 'lucide-react';

export default function LiveDialogs({ modal, data, today, onClose, onEditAttendance, save, mutation }) {
  if (!modal) return null;
  const member = data.members.find(row => row.id === modal.id);
  return <MutationContext.Provider value={mutation}>
    {modal.type === 'measurement-delete' && <Dialog title="Delete measurement?" subtitle={monthLabel(modal.row.measurement_month)} onClose={onClose}><div className="dialog-body"><p>{data.members.find(row=>row.id===modal.row.member_id)?.full_name}</p><p>This monthly entry will be removed from measurements and exports. Its audit history will be retained.</p></div><div className="dialog-footer"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={()=>save('measurement.delete',{id:modal.row.id,member_id:modal.row.member_id,expected_updated_at:modal.row.updated_at})}><Trash2 size={16}/>Delete measurement</Button></div></Dialog>}
    {modal.type === 'attendance-calendar' && member && <AttendanceCalendarDialog data={data} member={member} today={today} initialMonth={modal.month} onClose={onClose} onSave={values => save('attendance.calendar',values)}/>}
    {modal.type === 'member' && <MemberForm data={data} member={member} today={today} onClose={onClose} onSave={(values, id) => save('member.save', { ...values, id: id || null, expected_updated_at: member?.updated_at || null })} />}
    {modal.type === 'membership' && <MembershipForm data={data} memberId={modal.id} today={today} onClose={onClose} onSave={values => save('membership.add', values)} />}
    {modal.type === 'checkin' && member && <CheckInDialog data={data} member={member} today={today} onClose={onClose} onEditAttendance={onEditAttendance} onConfirm={(id, time) => save('attendance.checkin', { id, time, acknowledged: true })} />}
    {modal.type === 'attendance-edit' && <AttendanceEditDialog data={data} row={modal.row} onClose={onClose} onSave={values => save('attendance.time', { ...values, id: modal.row.id, expected_updated_at: modal.row.updated_at })} />}
    {modal.type === 'catalogue' && <CatalogueForm kind={modal.kind} row={modal.row} onClose={onClose} onSave={values => save('catalogue.save', { ...values, kind: modal.kind, id: modal.row?.id || null })} />}
    {modal.type === 'archive' && member && <Dialog title={member.archived_at ? 'Restore member?' : 'Archive member?'} onClose={onClose}><div className="dialog-body"><p>{member.full_name} · {member.member_code}</p><p>Membership and attendance history will be preserved.</p></div><div className="dialog-footer"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => save('member.archive', { id: member.id, archive: !member.archived_at, expected_updated_at: member.updated_at })}>Confirm</Button></div></Dialog>}
  </MutationContext.Provider>;
}
