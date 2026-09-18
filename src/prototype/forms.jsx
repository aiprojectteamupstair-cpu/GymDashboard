import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Info, RotateCw, ShieldCheck, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Dialog, Field } from './components.jsx';
import { addMonths, categoryLabel, currentMembership, endDate, formatDate, formatTime, membershipStatus } from './domain.js';

export function MemberForm({ data, member, today, onClose, onSave }) {
  const [values, setValues] = useState(member || { full_name: '', category_id: 'customer', contact_phone: '', date_of_birth: '', student_id: '', remark: '' });
  const [error, setError] = useState('');
  const update = (key, value) => setValues(v => ({ ...v, [key]: value }));
  const similar = data.members.filter(m => m.id !== member?.id && values.full_name.trim() && m.full_name.toLowerCase() === values.full_name.trim().toLowerCase());
  function submit(event) {
    event.preventDefault();
    try { onSave(values, member?.id); } catch (e) { setError(e.message); }
  }
  return <Dialog title={member ? 'Edit member' : 'Welcome a new member'} subtitle={member ? `${member.member_code} · Keep their information up to date.` : 'Start with the essentials. Membership can be added next.'} onClose={onClose} wide>
    <form onSubmit={submit}><div className="dialog-body">
      <div className="form-section-title"><span>01</span><h3>Member information</h3></div>
      <div className="form-grid">
        <Field label="Full name *"><input autoFocus required maxLength={120} value={values.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Enter full name" /></Field>
        <Field label="Member category *"><select value={values.category_id} onChange={e => update('category_id', e.target.value)}>{data.member_categories.filter(c => c.enabled).map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</select></Field>
        <Field label="Phone number" hint="Optional. Shared contact numbers are allowed."><input type="tel" value={values.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder="09…" /></Field>
        <Field label="Date of birth" hint="Optional. Age is calculated from this date."><input type="date" max={today} value={values.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></Field>
        <Field label="Student ID" hint="Optional, where applicable."><input value={values.student_id} onChange={e => update('student_id', e.target.value)} placeholder="Student reference" /></Field>
        <Field label="Member code"><input disabled value={member?.member_code || 'Assigned automatically on save'} /></Field>
        <Field label="Remark" className="span-two"><textarea rows={3} value={values.remark} onChange={e => update('remark', e.target.value)} placeholder="Anything the team should know…" /></Field>
      </div>
      {similar.length > 0 && <div className="inline-notice warning"><Info size={18} /><span>A member with this name exists ({similar.map(m => m.member_code).join(', ')}). Check whether this is a different person before saving.</span></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-footer"><span className="footer-note">Sample data · saved in this browser</span><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary"><UserPlus size={17} />{member ? 'Save changes' : 'Create member'}</Button></div></form>
  </Dialog>;
}

export function MembershipForm({ data, memberId, today, onClose, onSave }) {
  const [values, setValues] = useState({ member_id: memberId || '', package_id: 'september', start_date: today, payment_method_id: '', voucher_reference: '', override_end_date: '', override_reason: '', remark: '' });
  const [override, setOverride] = useState(false);
  const [error, setError] = useState('');
  const pack = data.packages.find(p => p.id === values.package_id);
  const calculated = addMonths(values.start_date, pack?.duration_months);
  const member = data.members.find(m => m.id === values.member_id);
  const previous = member ? currentMembership(data, member.id, today) : null;
  const explicitEnd = override || !pack?.duration_months;
  const chosenEnd = explicitEnd ? values.override_end_date : calculated;
  const overlaps = member && chosenEnd && data.memberships.some(m => m.member_id === member.id && !m.voided_at && endDate(m) >= values.start_date && m.start_date <= chosenEnd);
  function update(key, value) {
    setValues(v => ({ ...v, [key]: value, ...(['package_id', 'start_date'].includes(key) ? { override_end_date: '', override_reason: '' } : {}) }));
    if (['package_id', 'start_date'].includes(key)) setOverride(false);
  }
  function submit(e) {
    e.preventDefault();
    try { onSave({ ...values, override_end_date: explicitEnd ? values.override_end_date : '', override_reason: explicitEnd ? values.override_reason : '' }); } catch (err) { setError(err.message); }
  }
  return <Dialog title="New / renew membership" subtitle="A new membership record keeps the full history intact." onClose={onClose} wide>
    <form onSubmit={submit}><div className="dialog-body">
      <div className="form-section-title"><span>01</span><h3>Member & package</h3></div>
      <div className="form-grid">
        <Field label="Member *" className="span-two"><select required value={values.member_id} onChange={e => update('member_id', e.target.value)}><option value="">Choose a member</option>{data.members.filter(m => !m.archived_at).map(m => <option key={m.id} value={m.id}>{m.full_name} · {m.member_code}</option>)}</select></Field>
        <Field label="Package *"><select value={values.package_id} onChange={e => update('package_id', e.target.value)}>{data.packages.filter(p => p.enabled).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        <Field label="Payment method" hint="Example categories for review; no amounts are recorded."><select value={values.payment_method_id} onChange={e => update('payment_method_id', e.target.value)}><option value="">Not recorded</option>{data.payment_methods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      </div>
      <p className="package-note"><Info size={15} />{pack?.access_notes}. {pack?.duration_months ? `${pack.duration_months} calendar months.` : 'Duration is not confirmed.'}</p>
      {previous && <p className="previous-membership">Existing membership: <strong>{previous.package_snapshot.label}</strong> · ends {formatDate(endDate(previous))}</p>}
      <div className="form-section-title"><span>02</span><h3>Membership dates</h3></div>
      <div className="form-grid">
        <Field label="Start date *"><input type="date" required value={values.start_date} onChange={e => update('start_date', e.target.value)} /></Field>
        <div className="calculated-date"><span><CalendarDays size={16} />Calculated end date</span><strong>{calculated ? formatDate(calculated) : 'Needs an explicit end date'}</strong><small>{calculated ? 'Calendar months · adjusts for month-end' : 'No duration has been assumed for this package'}</small></div>
      </div>
      {pack?.duration_months && <label className="checkbox-label"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /><ShieldCheck size={17} />Admin override end date</label>}
      {explicitEnd && <div className="override-box form-grid"><Field label="Manual end date *"><input type="date" required min={values.start_date} value={values.override_end_date} onChange={e => update('override_end_date', e.target.value)} /></Field><Field label="Reason for manual date *"><input required value={values.override_reason} onChange={e => update('override_reason', e.target.value)} placeholder="Why is this date being set?" /></Field></div>}
      {overlaps && <div className="inline-notice warning"><Info size={18} /><span>These dates overlap an existing membership. Review the start date. Overlap policy is still being reviewed for the live system.</span></div>}
      <div className="form-grid form-last"><Field label="Voucher reference"><input value={values.voucher_reference} onChange={e => update('voucher_reference', e.target.value)} placeholder="Optional · may be shared" /></Field><Field label="Remark"><input value={values.remark} onChange={e => update('remark', e.target.value)} placeholder="Optional note" /></Field></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-footer"><span className="footer-note">Sample data · no payment amounts</span><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary"><RotateCw size={17} />Save membership</Button></div></form>
  </Dialog>;
}

export function CheckInDialog({ data, member, today, onClose, onConfirm }) {
  const [error, setError] = useState('');
  const membership = currentMembership(data, member.id, today);
  const status = membershipStatus(membership, today);
  const already = data.attendance.find(a => a.member_id === member.id && a.attendance_date === today && !a.voided_at);
  return <Dialog title="Confirm check-in" subtitle="Make sure you have the right member." onClose={onClose}>
    <div className="dialog-body"><div className="checkin-identity"><Avatar member={member} large /><h3>{member.full_name}</h3><p>{member.member_code} · {categoryLabel(data, member)}</p><Badge>{status}</Badge></div>
      <dl className="detail-list"><div><dt>Package</dt><dd>{membership?.package_snapshot.label || 'Not recorded'}</dd></div><div><dt>End date</dt><dd>{formatDate(endDate(membership))}</dd></div><div><dt>Access</dt><dd>{membership?.package_snapshot.access_notes || 'Not recorded'}</dd></div><div><dt>Today</dt><dd>{formatDate(today)}</dd></div></dl>
      {already ? <div className="inline-notice"><CheckCircle2 size={18} /><span>Already checked in at {formatTime(already.checked_in_at)}.</span></div> : <div className={`inline-notice ${status !== 'Active' ? 'warning' : ''}`}><Info size={18} /><span>{status !== 'Active' ? `${status} membership. ` : ''}This prototype records sample attendance only. Entry eligibility and access-hour rules will be confirmed before live use.</span></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-footer"><Button onClick={onClose}>{already ? 'Close' : 'Cancel'}</Button>{!already && <Button variant="primary" onClick={() => { try { onConfirm(member.id); } catch (e) { setError(e.message); } }}>Confirm check-in<ArrowRight size={17} /></Button>}</div>
  </Dialog>;
}
