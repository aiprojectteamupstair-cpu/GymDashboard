import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Info, RotateCw, ShieldCheck, UserPlus } from 'lucide-react';
import { Avatar, Badge, Button, Dialog, Field } from './components.jsx';
import { addMonths, categoryLabel, currentMembership, endDate, formatDate, formatTime, guestStatus, membershipStatus } from './domain.js';
import { CATEGORIES, nextMemberCode, TRAINING_MONTHS } from './catalogue.js';

function initialSubscription(today) {
  return { package_id: '', plan_id: '', discount_id: '', start_date: today, voucher_reference: '',
    override_end_date: '', override_reason: '', remark: '', training_type: 'none', training_sessions: '' };
}

function SubscriptionFields({ data, values, onChange }) {
  const [override, setOverride] = useState(Boolean(values.override_end_date));
  const pack = data.packages.find(p => p.id === values.package_id && p.enabled);
  const plan = data.membership_plans.find(p => p.id === values.plan_id && p.enabled);
  const calculated = addMonths(values.start_date, plan?.duration_months);
  const trainingMonths = TRAINING_MONTHS[values.training_sessions];
  function update(key, value) {
    let next = { ...values, [key]: value };
    if (['plan_id', 'start_date'].includes(key)) {
      next = { ...next, override_end_date: '', override_reason: '' };
      setOverride(false);
    }
    if (key === 'package_id' || key === 'training_type') next = { ...next, training_type: key === 'package_id' ? 'none' : value, training_sessions: '' };
    onChange(next);
  }
  return <>
    <div className="form-section-title"><span>02</span><h3>Package & plan</h3></div>
    <div className="form-grid">
      <Field label="Package *"><select required value={values.package_id} onChange={e => update('package_id', e.target.value)}><option value="">Choose a package</option>{data.packages.filter(p => p.enabled).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="Membership plan *"><select required value={values.plan_id} onChange={e => update('plan_id', e.target.value)}><option value="">Choose a plan</option>{data.membership_plans.filter(p => p.enabled).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="Discount"><select value={values.discount_id} onChange={e => update('discount_id', e.target.value)}><option value="">No discount</option>{data.discounts.filter(d => d.enabled).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    </div>
    {pack && <p className="package-note"><Info size={15} />{pack.access_notes || pack.label}</p>}
    <div className="form-section-title"><span>03</span><h3>Membership dates</h3></div>
    <div className="form-grid">
      <Field label="Start date *"><input required type="date" value={values.start_date} onChange={e => update('start_date', e.target.value)} /></Field>
      <div className="calculated-date"><span><CalendarDays size={16} />Calculated end date</span><strong>{calculated ? formatDate(calculated) : 'Select a plan and start date'}</strong><small>Calendar months · adjusts for month-end</small></div>
    </div>
    <label className="checkbox-label"><input type="checkbox" checked={override} onChange={e => { setOverride(e.target.checked); onChange({ ...values, override_end_date: '', override_reason: '' }); }} /><ShieldCheck size={17} />Admin override end date</label>
    {override && <div className="override-box form-grid"><Field label="Manual end date *"><input required type="date" min={values.start_date} value={values.override_end_date} onChange={e => update('override_end_date', e.target.value)} /></Field><Field label="Reason for manual date *"><input required value={values.override_reason} onChange={e => update('override_reason', e.target.value)} /></Field></div>}
    {pack?.allows_training && <div className="training-section"><div className="form-section-title"><span>04</span><h3>Personal training</h3></div><div className="form-grid">
      <Field label="PT"><select value={values.training_type} onChange={e => update('training_type', e.target.value)}><option value="none">Not required</option><option value="pt">Personal Trainer (PT)</option></select></Field>
      {values.training_type !== 'none' && <Field label="Training sessions *"><select required value={values.training_sessions} onChange={e => update('training_sessions', e.target.value)}><option value="">Choose sessions</option>{[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} times</option>)}</select></Field>}
    </div>{values.training_type !== 'none' && <div className="inline-notice"><CalendarDays size={17} /><span>Starts with membership: {formatDate(values.start_date)}{trainingMonths ? <><br />Complete within {trainingMonths} month{trainingMonths > 1 ? 's' : ''} · ends {formatDate(addMonths(values.start_date, trainingMonths))}</> : null}</span></div>}</div>}
    <div className="form-grid form-last"><Field label="Voucher No." hint="May be shared by multiple members. Leading zeroes are kept."><input value={values.voucher_reference} onChange={e => update('voucher_reference', e.target.value)} placeholder="Optional" /></Field><Field label="Membership remark"><input value={values.remark} onChange={e => update('remark', e.target.value)} placeholder="Optional" /></Field></div>
  </>;
}

export function MemberForm({ data, member, today, onClose, onSave }) {
  const [values, setValues] = useState(member || { full_name: '', category_id: 'customer', contact_phone: '', date_of_birth: '', student_id: '', remark: '' });
  const [subscription, setSubscription] = useState(() => initialSubscription(today));
  const [addMembership, setAddMembership] = useState(!member);
  const [error, setError] = useState('');
  const guest = values.category_id === 'guest';
  const conversion = member?.category_id === 'guest' && !guest;
  const includeMembership = !guest && (conversion || (!member && addMembership));
  const code = member && member.category_id === values.category_id ? member.member_code : nextMemberCode(data, values.category_id);
  const similar = data.members.filter(m => m.id !== member?.id && values.full_name.trim() && m.full_name.toLowerCase() === values.full_name.trim().toLowerCase());
  const update = (key, value) => setValues(v => ({ ...v, [key]: value }));
  function submit(event) {
    event.preventDefault();
    try { onSave({ ...values, membership: includeMembership ? subscription : null }, member?.id); } catch (e) { setError(e.message); }
  }
  return <Dialog title={conversion ? 'Convert guest to member' : member ? 'Edit member' : 'Add a member or guest'} subtitle={member ? `${member.member_code} · ${member.full_name}` : 'Create a profile and choose their access.'} onClose={onClose} wide>
    <form onSubmit={submit}><div className="dialog-body">
      <div className="form-section-title"><span>01</span><h3>Member information</h3></div>
      <div className="form-grid">
        <Field label="Full name *"><input autoFocus required maxLength={120} value={values.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Enter full name" /></Field>
        <Field label="Member category *"><select value={values.category_id} onChange={e => update('category_id', e.target.value)}>{CATEGORIES.filter(c => !(member && member.category_id !== 'guest' && c.id === 'guest')).map(c => <option value={c.id} key={c.id}>{c.label}</option>)}{values.category_id === 'unknown' && <option value="unknown">Unknown (historical)</option>}</select></Field>
        <Field label="Phone number" hint="Optional. Shared contact numbers are allowed."><input type="tel" value={values.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder="09…" /></Field>
        <Field label="Date of birth" hint="Optional. Age is calculated from this date."><input type="date" max={today} value={values.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></Field>
        {values.category_id === 'student' && <Field label="Student ID" hint="Optional."><input value={values.student_id} onChange={e => update('student_id', e.target.value)} /></Field>}
        <Field label="Member ID" hint={member?.member_code !== code && member ? `Previous ID ${member.member_code} stays linked to their history.` : 'Assigned automatically when saved.'}><input readOnly value={code || member?.member_code || ''} /></Field>
        <Field label="Remark" className="span-two"><textarea rows={2} value={values.remark} onChange={e => update('remark', e.target.value)} /></Field>
      </div>
      {guest && <div className="inline-notice"><Info size={18} /><span>One-day trial guest. No package or plan is required. Their trial day is recorded at the first check-in.</span></div>}
      {conversion && <div className="inline-notice"><UserPlus size={18} /><span>Select a package and plan below. The new member ID and membership will be saved together with their existing visit history.</span></div>}
      {!member && !guest && <label className="checkbox-label"><input type="checkbox" checked={addMembership} onChange={e => setAddMembership(e.target.checked)} />Add a membership now</label>}
      {includeMembership && <SubscriptionFields data={data} values={subscription} onChange={setSubscription} />}
      {similar.length > 0 && <div className="inline-notice warning"><Info size={18} /><span>This name also belongs to {similar.map(m => m.member_code).join(', ')}. Confirm this is a different person.</span></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary"><UserPlus size={17} />{conversion ? 'Convert to member' : member ? 'Save changes' : guest ? 'Create guest' : 'Create member'}</Button></div></form>
  </Dialog>;
}

export function MembershipForm({ data, memberId, today, onClose, onSave }) {
  const [selectedId, setSelectedId] = useState(memberId || '');
  const [values, setValues] = useState(() => initialSubscription(today));
  const [error, setError] = useState('');
  const member = data.members.find(m => m.id === selectedId);
  const previous = member ? currentMembership(data, member.id, today) : null;
  const calculated = addMonths(values.start_date, data.membership_plans.find(p => p.id === values.plan_id)?.duration_months);
  const chosenEnd = values.override_end_date || calculated;
  const overlaps = member && chosenEnd && data.memberships.some(m => m.member_id === member.id && !m.voided_at && endDate(m) >= values.start_date && m.start_date <= chosenEnd);
  return <Dialog title={previous ? 'Renew package' : 'Add package'} subtitle="Choose a package, plan and any additional services." onClose={onClose} wide>
    <form onSubmit={e => { e.preventDefault(); try { onSave({ ...values, member_id: selectedId }); } catch (err) { setError(err.message); } }}><div className="dialog-body">
      <Field label="Member *"><select required value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Choose a member</option>{data.members.filter(m => !m.archived_at && m.category_id !== 'guest').map(m => <option key={m.id} value={m.id}>{m.full_name} · {m.member_code}</option>)}</select></Field>
      {previous && <p className="previous-membership">Current: <strong>{previous.package_snapshot.label}</strong> · ends {formatDate(endDate(previous))}</p>}
      <SubscriptionFields data={data} values={values} onChange={setValues} />
      {overlaps && <div className="inline-notice warning"><Info size={18} /><span>These dates overlap an existing membership. Review the start date before saving.</span></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary"><RotateCw size={17} />Save membership</Button></div></form>
  </Dialog>;
}

export function CheckInDialog({ data, member, today, onClose, onConfirm, onEditAttendance }) {
  const [error, setError] = useState('');
  const [manualTime, setManualTime] = useState('');
  const guest = member.category_id === 'guest';
  const membership = currentMembership(data, member.id, today);
  const status = guest ? guestStatus(data, member, today) : membershipStatus(membership, today);
  const already = data.attendance.find(a => a.member_id === member.id && a.attendance_date === today && !a.voided_at);
  const used = guest && status === 'Trial used';
  return <Dialog title="Confirm check-in" subtitle="Make sure you have the right member." onClose={onClose}>
    <div className="dialog-body"><div className="checkin-identity"><Avatar member={member} large /><h3>{member.full_name}</h3><p>{member.member_code} · {categoryLabel(data, member)}</p><Badge>{status}</Badge></div>
      <dl className="detail-list">{!guest && <><div><dt>Package</dt><dd>{membership?.package_snapshot.label || 'Not recorded'}</dd></div><div><dt>Plan</dt><dd>{membership?.plan_snapshot?.label || 'Not recorded'}</dd></div><div><dt>End date</dt><dd>{formatDate(endDate(membership))}</dd></div><div><dt>Access</dt><dd>{membership?.package_snapshot.access_notes || 'Not recorded'}</dd></div></>}<div><dt>Today</dt><dd>{formatDate(today)}</dd></div></dl>
      {already ? <div className="inline-notice"><CheckCircle2 size={18} /><span>Already checked in at {formatTime(already.checked_in_at)}.</span></div> : <div className={`inline-notice ${used || (!guest && status !== 'Active') ? 'warning' : ''}`}><Info size={18} /><span>{used ? 'This guest has used their one-day trial. Open their profile and convert them to a member to continue.' : guest ? 'Record their one-day trial visit.' : status !== 'Active' ? `${status} membership. Confirm entry eligibility before recording attendance.` : 'Confirm their visit to record today’s attendance.'}</span></div>}
      {!already && !used && <div className="manual-time-field"><Field label="Check-in time (optional)" hint="Leave blank to use the current Myanmar time."><input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)}/></Field></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="dialog-footer">{already && <Button onClick={()=>onEditAttendance(already)}>Edit check-in time</Button>}<Button onClick={onClose}>{already || used ? 'Close' : 'Cancel'}</Button>{!already && !used && <Button variant="primary" onClick={() => { try { onConfirm(member.id, manualTime); } catch (e) { setError(e.message); } }}>Confirm check-in<ArrowRight size={17} /></Button>}</div>
  </Dialog>;
}

export function CatalogueForm({ kind, row, onClose, onSave }) {
  const [values, setValues] = useState(() => ({ label: '', access_notes: '', allows_training: false, percentage: '', enabled: true, ...row, expected_updated_at:row?.updated_at }));
  const [error, setError] = useState('');
  const item = kind === 'packages' ? 'package' : 'discount';
  const update = (key, value) => setValues(v => ({ ...v, [key]: value }));
  return <Dialog title={`${row ? 'Edit' : 'Add'} ${item}`} subtitle="Changes apply to new memberships. Existing membership history stays unchanged." onClose={onClose}>
    <form onSubmit={e => { e.preventDefault(); try { onSave(values); } catch (err) { setError(err.message); } }}><div className="dialog-body form-grid">
      <Field label={`${kind === 'packages' ? 'Package' : 'Discount'} name *`} className="span-two"><input autoFocus required maxLength={100} value={values.label} onChange={e => update('label', e.target.value)} /></Field>
      {kind === 'packages' ? <><Field label="Included facilities" className="span-two"><textarea rows={3} value={values.access_notes || ''} onChange={e => update('access_notes', e.target.value)} /></Field><label className="checkbox-label span-two"><input type="checkbox" checked={Boolean(values.allows_training)} onChange={e => update('allows_training', e.target.checked)} />Offer PT with this package</label></> : <Field label="Discount percentage *"><input type="number" required min="0.01" max="100" step="0.01" value={values.percentage} onChange={e => update('percentage', e.target.value)} /></Field>}
      <Field label="Status"><select value={values.enabled ? 'active' : 'inactive'} onChange={e => update('enabled', e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
      {error && <p className="form-error span-two" role="alert">{error}</p>}
    </div><div className="dialog-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save {item}</Button></div></form>
  </Dialog>;
}
