import { AttendanceHistory } from './AttendanceHistory.jsx';
import { AttendanceCalendar } from './AttendanceCalendar.jsx';
import { dashboardGroups } from './insights.js';
import { attendanceCoverage } from './coverage.js';
import { useState } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Settings2, Activity, ArrowLeft, ArrowRight, ArrowUpRight, Archive, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Edit3, Info, Plus, RotateCw, Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, Field, Panel, SearchField, StatCard } from './components.jsx';
import { ageOn, attendanceInPeriod, attendanceSeries, categoryLabel, currentMembership, endDate, findMembers, formatDate, formatTime, formatAttendanceTime, guestStatus, localDate, membershipStatus, shiftDays } from './domain.js';

function memberState(data, member, today) {
  const membership = currentMembership(data, member.id, today);
  return { membership, status: member.archived_at ? 'Archived' : member.category_id === 'guest' ? guestStatus(data, member, today) : membershipStatus(membership, today) };
}

export function AttendanceChart({ data, today, days = 14 }) {
  const series = attendanceSeries(data, today, days);
  return <div className="attendance-chart" role="img" aria-label={`Daily attendance over ${days} days: ${series.map(s => `${s.label}: ${s.visits}`).join(', ')}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={series} margin={{ top: 18, right: 12, left: -26, bottom: 2 }} accessibilityLayer>
        <defs><linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="var(--line)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} minTickGap={24} dy={10} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} domain={[0, 'auto']} />
        <Tooltip contentStyle={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 8, fontSize: 14 }} itemStyle={{ color: 'var(--ink)' }} formatter={value => [value, 'Check-ins']} />
        <Area type="linear" dataKey="visits" stroke="var(--accent)" strokeWidth={2.5} fill="url(#attendance-fill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 3 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function CategoryBreakdown({ data, rows, attendance = false }) {
  const colors = ['#b08a48', '#35384e', '#e87b88', '#9aa98d', '#6699b5', '#bbb9c7'];
  const entries = data.member_categories.map((c, i) => ({ ...c, color: colors[i % colors.length], count: rows.filter(r => attendance ? (r.member_category_snapshot === c.label || (c.id === 'staff' && r.member_category_snapshot === 'Staff')) : r.category_id === c.id).length }));
  const total = rows.length;
  const segments = entries.map((c, index) => {
    const start = entries.slice(0, index).reduce((sum, item) => sum + item.count, 0) / Math.max(1, total) * 100;
    return c.count ? `${c.color} ${start}% ${start + c.count / Math.max(1, total) * 100}%` : null;
  }).filter(Boolean);
  return <div className="breakdown"><div className="donut" style={{ background: segments.length ? `conic-gradient(${segments.join(', ')})` : '#ececf1' }} role="img" aria-label={entries.map(c => `${c.label}: ${c.count}`).join(', ')}><div><strong>{total}</strong><span>{attendance ? 'check-ins' : 'members'}</span></div></div><div className="breakdown-legend">{entries.filter(c => c.count || c.id !== 'unknown').map(c => <div key={c.id}><span className="legend-dot" style={{ background: c.color }} /><span>{c.label}</span><strong>{c.count}</strong><small>{total ? Math.round(c.count / total * 100) : 0}%</small></div>)}</div></div>;
}

export function AttendanceList({ rows, data, onProfile, limit }) {
  const sorted = [...rows].sort((a, b) => (b.checked_in_at || b.attendance_date).localeCompare(a.checked_in_at || a.attendance_date)).slice(0, limit);
  if (!sorted.length) return <EmptyState title="A fresh start" message="Today's check-ins will appear here. Search for a member to get started." />;
  return <div className="attendance-list">{sorted.map(a => {
    const member = data.members.find(m => m.id === a.member_id);
    if (!member) return null;
    return <button className="attendance-person" key={a.id} onClick={() => onProfile(member.id)}><Avatar member={member} /><span className="person-text"><strong>{member.full_name}</strong><small>{a.member_category_snapshot} · {member.member_code}</small></span><span className="attendance-time"><strong>{formatAttendanceTime(a)}</strong><small><span />Checked in</small></span><ChevronRight size={16} /></button>;
  })}</div>;
}


function MemberAttendancePanel({ groups, onDrilldown }) {
  return <Panel title="Member attendance" subtitle="Active membership follow-up" className="member-attendance-panel">
    <button className="attendance-active-total" onClick={() => onDrilldown('active')} aria-label={`All active: ${groups.active.length}`}><span><span className="status-dot status-green"/>All active</span><strong>{groups.active.length}</strong><ArrowUpRight size={19}/></button>
    <div className="attendance-followup-metrics">{[['quiet10','10–20 days','amber'],['quiet20','Over 20 days','red']].map(([kind,label,color]) => <button key={kind} onClick={() => onDrilldown(kind)} aria-label={`${label}: ${groups[kind].length}`}><span className={`status-dot status-${color}`}/><span>{label}</span><strong>{groups[kind].length}</strong><ChevronRight size={16}/></button>)}</div>
    <p className="attendance-metric-caption">Days since last recorded visit</p>
    <button className="attendance-unknown" onClick={() => onDrilldown('unvisited')}>No recorded visit<strong>{groups.unvisited.length}</strong><ArrowUpRight size={16}/></button>
  </Panel>;
}

export function Dashboard({ data, today, onNavigate, onProfile, onRenew, onDrilldown }) {
  const groups = dashboardGroups(data, today);
  const coverage = attendanceCoverage(data);
  const expiring = groups.expiring.map(member => ({ member, membership: currentMembership(data, member.id, today) })).sort((a, b) => endDate(a.membership).localeCompare(endDate(b.membership)));
  return <>
    <div className="page-heading"><h1 className="screen-title"><LayoutDashboard aria-hidden="true"/>Dashboard</h1><div className="date-card"><CalendarDays size={20} /><div><strong>{formatDate(today, { weekday: 'short' })}</strong><span>Yangon, Myanmar</span></div></div></div>
    {coverage.last && coverage.last < today && <p className="scope-note">Latest recorded attendance: {formatDate(coverage.last)}. Today's and this week's zero counts mean no records loaded for those dates, not verified absence. Yellow/red counts use the last recorded visit and may be affected by missing history. <button className="text-button" onClick={() => onNavigate('analytics')}>View historical attendance</button></p>}
    <div className="stats-grid dashboard-stats"><StatCard label="Today's check-ins" value={groups.arrivals.length} description="View today's arrival records" icon={DoorOpen} accent onClick={() => onDrilldown('arrivals')} /><StatCard label="Registered members" value={groups.members.length} description="All current profiles, including guests" icon={Users} onClick={() => onDrilldown('members')} /><StatCard label="Expiring soon" value={groups.expiring.length} description="Ends today or within 14 days" icon={Clock3} onClick={() => onDrilldown('expiring')} /><StatCard label="New / Renew" value={groups.activity.length} description={`${groups.activity.filter(m=>m.activity_kind === 'New').length} new · ${groups.activity.filter(m=>m.activity_kind === 'Renew').length} renewed today`} icon={RotateCw} onClick={() => onDrilldown('activity')} /></div>
    <div className="dashboard-middle dashboard-overview"><Panel title="This week's attendance" subtitle="Recorded visits over the last 7 days"><AttendanceChart data={data} today={today} days={7} /><button className="panel-bottom-link" onClick={() => onNavigate('analytics')}>Explore trends in Analytics<ArrowRight size={17} /></button></Panel><MemberAttendancePanel groups={groups} onDrilldown={onDrilldown}/><Panel title="Your community" subtitle="Current profiles by category"><CategoryBreakdown data={data} rows={groups.members} /></Panel></div>
    <div className="dashboard-operations"><Panel title="Today's check-ins" subtitle="Latest recorded check-ins" action={<button className="text-button" onClick={() => onDrilldown('arrivals')}>View all<ArrowUpRight size={16} /></button>}><AttendanceList rows={groups.arrivals} data={data} onProfile={onProfile} limit={10} /><button className="panel-bottom-link" onClick={() => onNavigate('checkin')}>Go to check-in<ArrowRight size={17} /></button></Panel>
      <Panel title="Membership follow-up" subtitle="Upcoming end dates, in date order" action={<button className="text-button" onClick={() => onDrilldown('expiring')}>View all<ArrowUpRight size={16} /></button>}>{expiring.length ? <div className="followup-list">{expiring.slice(0, 5).map(({ member, membership }) => <div className="followup-person" key={member.id}><Avatar member={member} /><button className="person-text" onClick={() => onProfile(member.id)}><strong>{member.full_name}</strong><small>{endDate(membership) === today ? 'Ends today' : `Ends ${formatDate(endDate(membership), { year: undefined })}`}</small></button><Button onClick={() => onRenew(member.id)}>Renew<ArrowRight size={15} /></Button></div>)}</div> : <EmptyState title="No upcoming expiries" message="No memberships end in the next 14 days." />}</Panel></div>

  </>;
}

export function MemberDirectory({ data, today, onProfile, onAdd, onRenew, onCheckIn }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('name');
  const rows = findMembers(data, query, category, archived).filter(m => status === 'all' || memberState(data, m, today).status === status).sort((a, b) => sort === 'name' ? a.full_name.localeCompare(b.full_name) : b.created_at.localeCompare(a.created_at));
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * 8, safePage * 8);
  return <>
    <div className="page-heading"><h1 className="screen-title"><Users aria-hidden="true"/>Members</h1><Button variant="primary" onClick={onAdd}><Plus size={18} />New member</Button></div>
    <div className="category-tabs" role="group" aria-label="Member category filter">{[{ id: 'all', label: 'All members' }, ...data.member_categories.filter(c => c.id !== 'unknown')].map(c => <button key={c.id} className={category === c.id ? 'selected' : ''} onClick={() => { setCategory(c.id); setPage(1); }}>{c.label}<span>{data.members.filter(m => Boolean(m.archived_at) === archived && (c.id === 'all' || m.category_id === c.id)).length}</span></button>)}</div>
    <section className="panel directory-panel"><div className="directory-toolbar"><SearchField value={query} onChange={v => { setQuery(v); setPage(1); }} placeholder="Search by name, phone or member code" /><select aria-label="Filter membership status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option>{['Active', 'Ends today', 'Upcoming', 'Expired', 'Unknown', 'Trial available', 'Trial today', 'Trial used'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Sort members" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="newest">Newest first</option></select><label className="archive-filter"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); setStatus('all'); setPage(1); }} />Archived</label></div>
      <div className="table-scroll"><table className="member-table"><thead><tr><th>Member</th><th>Category</th><th>Membership</th><th>End date</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(member => {
        const { membership, status: memberStatus } = memberState(data, member, today);
        const checked = data.attendance.some(a => a.member_id === member.id && a.attendance_date === today && !a.voided_at);
        return <tr key={member.id}><td><button className="table-member" onClick={() => onProfile(member.id)}><Avatar member={member} /><span><strong>{member.full_name}</strong><small>{member.member_code}</small></span></button></td><td><span className={`category-label category-${member.category_id}`}>{categoryLabel(data, member)}</span></td><td><span className="package-cell">{member.category_id === 'guest' ? 'One-day trial' : membership?.package_snapshot.label || 'No membership'}<small>{member.category_id === 'guest' ? 'No package required' : [membership?.plan_snapshot?.label, membership?.discount_snapshot?.label].filter(Boolean).join(' · ') || 'Plan not recorded'}</small></span></td><td className="date-cell">{endDate(membership) ? formatDate(endDate(membership), { year: undefined }) : '—'}</td><td><Badge>{memberStatus}</Badge></td><td><div className="row-actions">{!archived && <button className="icon-button" aria-label={`${checked ? 'View check-in for' : 'Check in'} ${member.full_name}`} onClick={() => onCheckIn(member.id)}>{checked ? <CheckCircle2 size={18} className="success-text" /> : <DoorOpen size={18} />}</button>}<button className="icon-button" aria-label={`Open profile for ${member.full_name}`} onClick={() => onProfile(member.id)}><ArrowUpRight size={18} /></button></div></td></tr>;
      })}</tbody></table></div>
      {!rows.length && <EmptyState action={<Button onClick={() => { setQuery(''); setStatus('all'); setCategory('all'); }}>Clear filters</Button>} />}
      <div className="table-footer"><span>{rows.length ? `${(safePage - 1) * 8 + 1}–${Math.min(safePage * 8, rows.length)} of ${rows.length} members` : '0 members'}</span><div><Button aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></Button><span>Page {safePage} of {pages}</span><Button aria-label="Next page" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></Button></div></div>
    </section>
    <div className="directory-callout"><div className="callout-icon"><RotateCw size={21} /></div><div><strong>A new chapter for an existing member?</strong><p>Add a renewal while keeping their membership history.</p></div><Button onClick={() => onRenew(null)}>Add / renew package<ArrowRight size={17} /></Button></div>
  </>;
}

export function CheckInPage({ data, today, onProfile, onCheckIn }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const members = findMembers(data, query, category);
  const arrivals = attendanceInPeriod(data, today, today);
  return <>
    <div className="page-heading"><h1 className="screen-title"><DoorOpen aria-hidden="true"/>Check-in</h1><span className="today-badge"><span />{arrivals.length} checked in today</span></div>
    <div className="checkin-layout"><section className="panel checkin-search"><div className="checkin-search-heading"><div className="checkin-search-icon"><Search size={25} /></div><h2>Find a member</h2><p>Search by name, phone number or member code.</p><SearchField value={query} onChange={setQuery} placeholder="Start typing a member’s name…" label="Find a member to check in" /></div><div className="search-results-heading"><span>{query ? `${members.length} results` : 'Your members'}</span><select className="compact-select" aria-label="Check-in category filter" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{data.member_categories.filter(c => c.enabled).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div className="checkin-results">{members.slice(0, query ? 30 : 6).map(member => {
        const { status, membership } = memberState(data, member, today);
        const arrival = arrivals.find(a => a.member_id === member.id);
        return <div className="checkin-result" key={member.id}><Avatar member={member} /><button className="person-text" onClick={() => onProfile(member.id)}><strong>{member.full_name}</strong><small>{member.member_code} · {membership?.package_snapshot.label || categoryLabel(data, member)}</small><Badge>{status}</Badge></button><Button variant={arrival ? 'quiet' : 'secondary'} onClick={() => onCheckIn(member.id)}>{arrival ? <><Check size={16} />{formatAttendanceTime(arrival)}</> : <>Check in<ArrowRight size={16} /></>}</Button></div>;
      })}</div>{!members.length && <EmptyState title="No matching member" message="Try their phone or member code, or add a profile from the Member directory." />}{!query && members.length > 6 && <div className="soft-note">Showing 6 of {members.length} members. Search to find someone else.</div>}</section>
      <Panel title="Today's check-ins" subtitle={formatDate(today)} action={<span className="count-pill">{arrivals.length}</span>}><AttendanceList rows={arrivals} data={data} onProfile={onProfile} /></Panel></div>
    <div className="reception-note"><ShieldCheck size={18} /><p>One presence record per member, per Myanmar calendar day. Repeat check-ins show the original time.</p></div>
  </>;
}

export function MemberProfile({ data, member, today, onBack, onEdit, onRenew, onCheckIn, onArchive, onEditAttendance, onManageAttendance }) {
  const { membership, status } = memberState(data, member, today);
  const age = ageOn(member.date_of_birth, today);
  const guest = member.category_id === 'guest';
  const training = data.training_purchases.filter(t => t.member_id === member.id && !t.voided_at);
  const history = data.memberships.filter(m => m.member_id === member.id).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const visits = data.attendance.filter(a => a.member_id === member.id && !a.voided_at).sort((a, b) => (b.checked_in_at || b.attendance_date).localeCompare(a.checked_in_at || a.attendance_date));
  const audit = data.audit_events.filter(a => a.entity_id === member.id || history.some(h => h.id === a.entity_id) || visits.some(v => v.id === a.entity_id)).slice(0, 8);
  return <>
    <button className="text-button back-link" onClick={onBack}><ArrowLeft size={16} />Back to members</button>
    <div className="profile-hero"><Avatar member={member} large /><div className="profile-heading"><span className="eyebrow">{member.member_code}</span><h1>{member.full_name}</h1><div><span>{categoryLabel(data, member)}</span><Badge>{status}</Badge></div></div><div className="profile-actions"><Button onClick={onEdit}><Edit3 size={16} />Edit profile</Button>{guest && !member.archived_at && <Button onClick={onEdit}><UserCheck size={16} />Convert to member</Button>}{!member.archived_at && <Button variant="primary" onClick={onCheckIn}><DoorOpen size={17} />Check in</Button>}</div></div>
    <div className="profile-layout"><div className="stack"><Panel title="Member information" subtitle="The essentials, all in one place."><dl className="detail-list"><div><dt>Phone</dt><dd>{member.contact_phone || 'Not recorded'}</dd></div><div><dt>Date of birth</dt><dd>{member.date_of_birth ? formatDate(member.date_of_birth) : 'Not recorded'}</dd></div><div><dt>Age</dt><dd>{age === null ? 'Not recorded' : `${age} years`}</dd></div>{member.category_id === 'student' && <div><dt>Student ID</dt><dd>{member.student_id || 'Not recorded'}</dd></div>}{member.previous_codes?.length > 0 && <div><dt>Previous IDs</dt><dd>{member.previous_codes.join(', ')}</dd></div>}<div><dt>Last visit</dt><dd>{visits[0] ? formatDate(visits[0].attendance_date) : 'No visits yet'}</dd></div></dl><div className="profile-remark"><span>REMARK</span><p>{member.remark || 'No notes yet.'}</p></div></Panel>
      {guest ? <Panel title="Guest trial" subtitle="One-day access"><div className="membership-detail"><Badge>{status}</Badge><p>A package and plan can be added when this guest becomes a member.</p>{!member.archived_at && <Button onClick={onEdit}>Convert to member<ArrowRight size={16} /></Button>}</div></Panel> : <Panel title="Membership" action={!member.archived_at && <button className="text-button" onClick={onRenew}>{membership ? 'Renew package' : 'Add package'}<RotateCw size={14} /></button>}>{membership ? <div className="membership-detail"><div className="package-mark"><ShieldCheck size={23} /></div><h3>{membership.package_snapshot.label}</h3><p>{membership.package_snapshot.access_notes}</p><dl className="detail-list"><div><dt>Plan</dt><dd>{membership.plan_snapshot?.label || 'Not recorded'}</dd></div><div><dt>Discount</dt><dd>{membership.discount_snapshot?.label || (membership.plan_snapshot ? 'No discount' : 'Not recorded')}</dd></div><div><dt>Start date</dt><dd>{formatDate(membership.start_date)}</dd></div><div><dt>End date</dt><dd>{formatDate(endDate(membership))}</dd></div><div><dt>Voucher No.</dt><dd>{membership.voucher_reference || 'Not recorded'}</dd></div></dl>{membership.override_end_date && <div className="inline-notice"><Info size={16} /><span>Manual end date · {membership.override_reason}<br />Calculated: {formatDate(membership.calculated_end_date)}</span></div>}</div> : <EmptyState title="Ready for a membership" message="Choose a package and plan to get started." action={!member.archived_at && <Button onClick={onRenew}>Add package</Button>} />}</Panel>}
      {training.length > 0 && <Panel title="PT" subtitle="Purchased sessions and completion dates"><div className="training-history">{training.map(t => <article key={t.id}><strong>PT · {t.sessions} times</strong><p>{formatDate(t.start_date)} → {formatDate(t.end_date)}</p><p>Complete within {t.duration_months} month{t.duration_months > 1 ? 's' : ''}</p></article>)}</div></Panel>}
      <button className="archive-button" onClick={onArchive}><Archive size={16} />{member.archived_at ? 'Restore member' : 'Archive member'}</button></div>
      <div className="stack"><AttendanceCalendar data={data} member={member} today={today} onManageAttendance={onManageAttendance} /><AttendanceHistory rows={visits} onEditAttendance={onEditAttendance} />
      <Panel title="Membership history" subtitle={`${history.length} records · each renewal stays connected`}><div className="history-list">{history.map(h => <div className="history-item" key={h.id}><div className="timeline-dot" /><div><strong>{h.package_snapshot.label}</strong><small>{[h.plan_snapshot?.label, h.discount_snapshot?.label].filter(Boolean).join(' · ')}</small><p>{formatDate(h.start_date)} <ArrowRight size={12} /> {formatDate(endDate(h))}</p><small>Voucher No. {h.voucher_reference || 'Not recorded'}{h.override_end_date ? ' · Admin end date' : ''}</small></div><Badge>{membershipStatus(h, today)}</Badge></div>)}{!history.length && <EmptyState title="No membership history" message="New memberships and renewals will appear here." />}</div></Panel>
      {audit.length > 0 && <Panel title="Recent changes" subtitle="Activity history"><div className="audit-list">{audit.map(a => <div key={a.id}><Activity size={15} /><div><strong>{a.action.replaceAll('.', ' ').replaceAll('_', ' ')}</strong><small>{formatDate(localDate(a.occurred_at))} · {formatTime(a.occurred_at)} · {a.actor_name || data.app_staff.find(s => s.user_id === a.actor_user_id)?.display_name || 'Admin'}</small>{a.reason && <p>{a.reason}</p>}</div></div>)}</div></Panel>}</div></div>
  </>;
}

export function CataloguePage({ data, onCreate, onToggle, onEdit, canEdit }) {
  const [tab, setTab] = useState('packages');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const rows = data[tab].filter(row => row.label.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || row.enabled === (status === 'active')));
  return <><div className="page-heading"><h1 className="screen-title"><Settings2 aria-hidden="true"/>Packages & Discounts</h1><Button variant="primary" onClick={() => onCreate(tab)}><Plus size={18} />{tab === 'packages' ? 'Add package' : 'Add discount'}</Button></div>
    <div className="category-tabs" role="group" aria-label="Catalogue section">{['packages', 'discounts'].map(key => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => { setTab(key); setQuery(''); setStatus('all'); }}>{key === 'packages' ? 'Packages' : 'Discounts'}<span>{data[key].filter(r => r.enabled).length} active</span></button>)}</div>
    <section className="panel catalogue-panel"><div className="catalogue-toolbar"><SearchField value={query} onChange={setQuery} label="Search catalogue" placeholder={tab === 'packages' ? 'Search packages' : 'Search discounts'} /><select aria-label="Catalogue status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <div className="table-scroll"><table className="member-table"><thead><tr><th>{tab === 'packages' ? 'Package' : 'Discount'}</th><th>{tab === 'packages' ? 'Included facilities' : 'Percentage'}</th>{tab === 'packages' && <th>PT</th>}<th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.label}</strong>{row.legacy && <small className="legacy-label">Historical</small>}</td><td>{tab === 'packages' ? row.access_notes || '—' : `${row.percentage}%`}</td>{tab === 'packages' && <td>{row.allows_training ? 'Available' : '—'}</td>}<td><Badge>{row.enabled ? 'Active' : 'Inactive'}</Badge></td><td><div className="catalogue-actions">{canEdit && !row.legacy && <Button aria-label={`Edit ${row.label}`} onClick={()=>onEdit(tab,row)}><Edit3 size={15}/>Edit</Button>}{!row.legacy && <Button aria-label={`${row.enabled ? 'Deactivate' : 'Activate'} ${row.label}`} onClick={() => onToggle(tab, row)}>{row.enabled ? 'Deactivate' : 'Activate'}</Button>}</div></td></tr>)}</tbody></table></div>
      {!rows.length && <EmptyState title="No matching records" message="Try another search or status." />}
      <div className="soft-note"><Info size={16} />Only active items appear in membership dropdowns. Existing memberships keep their original selections.</div>
    </section><Panel title="Membership plans" subtitle="Available for each package"><div className="catalogue-plans">{data.membership_plans.map(p => <span className="category-label" key={p.id}>{p.label}</span>)}</div></Panel>
  </>;
}
