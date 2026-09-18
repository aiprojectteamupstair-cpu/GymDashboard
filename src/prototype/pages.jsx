import { useState } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Archive, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, DoorOpen, Edit3, Info, Plus, RotateCw, Search, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState, Field, Panel, SearchField, StatCard } from './components.jsx';
import { ageOn, attendanceInPeriod, attendanceSeries, categoryLabel, currentMembership, endDate, findMembers, formatDate, formatTime, localDate, membershipStatus, shiftDays } from './domain.js';

function memberState(data, member, today) {
  const membership = currentMembership(data, member.id, today);
  return { membership, status: member.archived_at ? 'Archived' : membershipStatus(membership, today) };
}

export function AttendanceChart({ data, today, days = 14 }) {
  const series = attendanceSeries(data, today, days);
  return <div className="attendance-chart" role="img" aria-label={`Daily attendance over ${days} days: ${series.map(s => `${s.label}: ${s.visits}`).join(', ')}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={series} margin={{ top: 18, right: 12, left: -26, bottom: 2 }} accessibilityLayer>
        <defs><linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d84d5e" stopOpacity={0.18} /><stop offset="100%" stopColor="#d84d5e" stopOpacity={0.01} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#e9eaf0" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#687183', fontSize: 11 }} minTickGap={24} dy={10} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#687183', fontSize: 11 }} domain={[0, 'auto']} />
        <Tooltip contentStyle={{ border: '1px solid #e6e7ed', borderRadius: 12, boxShadow: '0 6px 25px #20233612', fontSize: 12 }} itemStyle={{ color: '#687183' }} formatter={value => [value, 'Check-ins']} />
        <Area type="monotone" dataKey="visits" stroke="#d84d5e" strokeWidth={2.5} fill="url(#attendance-fill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 3 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function CategoryBreakdown({ data, rows, attendance = false }) {
  const colors = ['#35384e', '#e87b88', '#9aa98d', '#bbb9c7'];
  const entries = data.member_categories.map((c, i) => ({ ...c, color: colors[i], count: rows.filter(r => attendance ? r.member_category_snapshot === c.label : r.category_id === c.id).length }));
  const total = rows.length;
  const segments = entries.map((c, index) => {
    const start = entries.slice(0, index).reduce((sum, item) => sum + item.count, 0) / Math.max(1, total) * 100;
    return c.count ? `${c.color} ${start}% ${start + c.count / Math.max(1, total) * 100}%` : null;
  }).filter(Boolean);
  return <div className="breakdown"><div className="donut" style={{ background: segments.length ? `conic-gradient(${segments.join(', ')})` : '#ececf1' }} role="img" aria-label={entries.map(c => `${c.label}: ${c.count}`).join(', ')}><div><strong>{total}</strong><span>{attendance ? 'check-ins' : 'members'}</span></div></div><div className="breakdown-legend">{entries.filter(c => c.count || c.id !== 'unknown').map(c => <div key={c.id}><span className="legend-dot" style={{ background: c.color }} /><span>{c.label}</span><strong>{c.count}</strong><small>{total ? Math.round(c.count / total * 100) : 0}%</small></div>)}</div></div>;
}

export function AttendanceList({ rows, data, onProfile, limit }) {
  const sorted = [...rows].sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)).slice(0, limit);
  if (!sorted.length) return <EmptyState title="A fresh start" message="Today's check-ins will appear here. Search for a member to get started." />;
  return <div className="attendance-list">{sorted.map(a => {
    const member = data.members.find(m => m.id === a.member_id);
    if (!member) return null;
    return <button className="attendance-person" key={a.id} onClick={() => onProfile(member.id)}><Avatar member={member} /><span className="person-text"><strong>{member.full_name}</strong><small>{a.member_category_snapshot} · {member.member_code}</small></span><span className="attendance-time"><strong>{formatTime(a.checked_in_at)}</strong><small><span />Checked in</small></span><ChevronRight size={16} /></button>;
  })}</div>;
}

export function Dashboard({ data, today, onNavigate, onProfile, onRenew }) {
  const [days, setDays] = useState(14);
  const members = data.members.filter(m => !m.archived_at);
  const todaysRows = attendanceInPeriod(data, today, today);
  const active = members.filter(m => memberState(data, m, today).status === 'Active');
  const expiring = members.map(member => ({ member, ...memberState(data, member, today) })).filter(r => endDate(r.membership) >= today && endDate(r.membership) <= shiftDays(today, 14) && r.membership.start_date <= today).sort((a, b) => endDate(a.membership).localeCompare(endDate(b.membership)));
  const periodRows = attendanceInPeriod(data, shiftDays(today, 1 - days), today);
  return <>
    <div className="welcome-line"><div><span className="eyebrow">THE COMMUNITY, AT A GLANCE</span><h1>A little stronger, together<span>.</span></h1><p>Here's what's happening at your gym today.</p></div><div className="date-card"><CalendarDays size={18} /><div><strong>{formatDate(today, { weekday: 'short' })}</strong><span>Yangon, Myanmar</span></div></div></div>
    <div className="stats-grid"><StatCard label="Today's check-ins" value={todaysRows.length} description="People through the door today" icon={DoorOpen} accent /><StatCard label="Active memberships" value={active.length} description="Currently within their date range" icon={UserCheck} /><StatCard label="Registered members" value={members.length} description="Across all member categories" icon={Users} /><StatCard label="Expiring soon" value={expiring.length} description="Ends today or within 14 days" icon={Clock3} /></div>
    <div className="dashboard-middle"><Panel title="Attendance overview" subtitle={`${periodRows.length} check-ins across the last ${days} days`} action={<select className="compact-select" aria-label="Attendance chart period" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select>}><AttendanceChart data={data} today={today} days={days} /><div className="chart-footer"><span><i />Daily check-ins</span><button className="text-button" onClick={() => onNavigate('analytics')}>Explore attendance<ArrowUpRight size={15} /></button></div></Panel>
      <Panel title="Our community" subtitle="Registered members by category"><CategoryBreakdown data={data} rows={members} /><button className="panel-bottom-link" onClick={() => onNavigate('members')}>View member directory<ArrowRight size={16} /></button></Panel></div>
    <div className="dashboard-bottom"><Panel title="Today's arrivals" subtitle="A familiar face. A new beginning." action={<button className="text-button" onClick={() => onNavigate('checkin')}>View all<ArrowUpRight size={15} /></button>}><AttendanceList rows={todaysRows} data={data} onProfile={onProfile} limit={5} /></Panel>
      <Panel title="Memberships to follow up" subtitle="A helpful heads-up for your team." action={<span className="count-pill">{expiring.length}</span>}>
        {expiring.length ? <div className="followup-list">{expiring.slice(0, 4).map(({ member, membership }) => <div className="followup-person" key={member.id}><Avatar member={member} /><button className="person-text" onClick={() => onProfile(member.id)}><strong>{member.full_name}</strong><small>{endDate(membership) === today ? 'Ends today' : `Ends ${formatDate(endDate(membership), { year: undefined })}`}</small></button><button className="small-action" onClick={() => onRenew(member.id)}>Renew<ArrowRight size={14} /></button></div>)}</div> : <EmptyState title="Nothing to follow up" message="No memberships end in the next 14 days." />}
        <div className="soft-note"><Info size={15} />End-date entry rules will be confirmed before live use.</div>
      </Panel></div>
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
    <div className="page-heading"><div><span className="eyebrow">PEOPLE MAKE THE COMMUNITY</span><h1>Member directory</h1><p>Get to know your members. Keep every detail connected.</p></div><Button variant="primary" onClick={onAdd}><Plus size={18} />New member</Button></div>
    <div className="category-tabs" role="group" aria-label="Member category filter">{[{ id: 'all', label: 'All members' }, ...data.member_categories.filter(c => c.id !== 'unknown')].map(c => <button key={c.id} className={category === c.id ? 'selected' : ''} onClick={() => { setCategory(c.id); setPage(1); }}>{c.label}<span>{data.members.filter(m => Boolean(m.archived_at) === archived && (c.id === 'all' || m.category_id === c.id)).length}</span></button>)}</div>
    <section className="panel directory-panel"><div className="directory-toolbar"><SearchField value={query} onChange={v => { setQuery(v); setPage(1); }} placeholder="Search by name, phone or member code" /><select aria-label="Filter membership status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option>{['Active', 'Ends today', 'Upcoming', 'Expired', 'Unknown'].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Sort members" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="newest">Newest first</option></select><label className="archive-filter"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); setStatus('all'); setPage(1); }} />Archived</label></div>
      <div className="table-scroll"><table className="member-table"><thead><tr><th>Member</th><th>Category</th><th>Membership</th><th>End date</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(member => {
        const { membership, status: memberStatus } = memberState(data, member, today);
        const checked = data.attendance.some(a => a.member_id === member.id && a.attendance_date === today && !a.voided_at);
        return <tr key={member.id}><td><button className="table-member" onClick={() => onProfile(member.id)}><Avatar member={member} /><span><strong>{member.full_name}</strong><small>{member.member_code}</small></span></button></td><td><span className={`category-label category-${member.category_id}`}>{categoryLabel(data, member)}</span></td><td><span className="package-cell">{membership?.package_snapshot.label || 'No membership'}<small>{membership?.payment_method_label_snapshot || 'Payment not recorded'}</small></span></td><td className="date-cell">{endDate(membership) ? formatDate(endDate(membership), { year: undefined }) : '—'}</td><td><Badge>{memberStatus}</Badge></td><td><div className="row-actions">{!archived && <button className="icon-button" aria-label={`${checked ? 'View check-in for' : 'Check in'} ${member.full_name}`} onClick={() => onCheckIn(member.id)}>{checked ? <CheckCircle2 size={18} className="success-text" /> : <DoorOpen size={18} />}</button>}<button className="icon-button" aria-label={`Open profile for ${member.full_name}`} onClick={() => onProfile(member.id)}><ArrowUpRight size={18} /></button></div></td></tr>;
      })}</tbody></table></div>
      {!rows.length && <EmptyState action={<Button onClick={() => { setQuery(''); setStatus('all'); setCategory('all'); }}>Clear filters</Button>} />}
      <div className="table-footer"><span>{rows.length ? `${(safePage - 1) * 8 + 1}–${Math.min(safePage * 8, rows.length)} of ${rows.length} members` : '0 members'}</span><div><Button aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></Button><span>Page {safePage} of {pages}</span><Button aria-label="Next page" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></Button></div></div>
    </section>
    <div className="directory-callout"><div className="callout-icon"><RotateCw size={21} /></div><div><strong>A new chapter for an existing member?</strong><p>Add a renewal while keeping their membership history.</p></div><Button onClick={() => onRenew(null)}>New / renew membership<ArrowRight size={17} /></Button></div>
  </>;
}

export function CheckInPage({ data, today, onProfile, onCheckIn }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const members = findMembers(data, query, category);
  const arrivals = attendanceInPeriod(data, today, today);
  return <>
    <div className="page-heading"><div><span className="eyebrow">MAKE EVERY VISIT COUNT</span><h1>Welcome to the gym<span>.</span></h1><p>Find your member. Confirm their visit. They're ready to go.</p></div><span className="today-badge"><span />{arrivals.length} checked in today</span></div>
    <div className="checkin-layout"><section className="panel checkin-search"><div className="checkin-search-heading"><div className="checkin-search-icon"><Search size={25} /></div><h2>Who’s joining us today?</h2><p>Search by name, phone number or member code.</p><SearchField value={query} onChange={setQuery} placeholder="Start typing a member’s name…" label="Find a member to check in" /></div><div className="search-results-heading"><span>{query ? `${members.length} results` : 'Your members'}</span><select className="compact-select" aria-label="Check-in category filter" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{data.member_categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div className="checkin-results">{members.slice(0, query ? 30 : 6).map(member => {
        const { status, membership } = memberState(data, member, today);
        const arrival = arrivals.find(a => a.member_id === member.id);
        return <div className="checkin-result" key={member.id}><Avatar member={member} /><button className="person-text" onClick={() => onProfile(member.id)}><strong>{member.full_name}</strong><small>{member.member_code} · {membership?.package_snapshot.label || categoryLabel(data, member)}</small><Badge>{status}</Badge></button><Button variant={arrival ? 'quiet' : 'secondary'} onClick={() => onCheckIn(member.id)}>{arrival ? <><Check size={16} />{formatTime(arrival.checked_in_at)}</> : <>Check in<ArrowRight size={16} /></>}</Button></div>;
      })}</div>{!members.length && <EmptyState title="No matching member" message="Try their phone or member code, or add a profile from the Member directory." />}{!query && members.length > 6 && <div className="soft-note">Showing 6 of {members.length} members. Search to find someone else.</div>}</section>
      <Panel title="Today's check-ins" subtitle={formatDate(today)} action={<span className="count-pill">{arrivals.length}</span>}><AttendanceList rows={arrivals} data={data} onProfile={onProfile} /></Panel></div>
    <div className="reception-note"><ShieldCheck size={18} /><p>One presence record per member, per Myanmar calendar day. Repeat check-ins show the original time.</p></div>
  </>;
}

export function MemberProfile({ data, member, today, onBack, onEdit, onRenew, onCheckIn, onArchive }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const { membership, status } = memberState(data, member, today);
  const age = ageOn(member.date_of_birth, today);
  const history = data.memberships.filter(m => m.member_id === member.id).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const visits = data.attendance.filter(a => a.member_id === member.id && !a.voided_at).sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at));
  const monthVisits = visits.filter(a => a.attendance_date.startsWith(month));
  const [year, monthNumber] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const audit = data.audit_events.filter(a => a.entity_id === member.id || history.some(h => h.id === a.entity_id) || visits.some(v => v.id === a.entity_id)).slice(0, 8);
  return <>
    <button className="text-button back-link" onClick={onBack}><ArrowLeft size={16} />Back to members</button>
    <div className="profile-hero"><Avatar member={member} large /><div className="profile-heading"><span className="eyebrow">{member.member_code}</span><h1>{member.full_name}</h1><div><span>{categoryLabel(data, member)}</span><Badge>{status}</Badge></div></div><div className="profile-actions"><Button onClick={onEdit}><Edit3 size={16} />Edit profile</Button>{!member.archived_at && <Button variant="primary" onClick={onCheckIn}><DoorOpen size={17} />Check in</Button>}</div></div>
    <div className="profile-layout"><div className="stack"><Panel title="Member information" subtitle="The essentials, all in one place."><dl className="detail-list"><div><dt>Phone</dt><dd>{member.contact_phone || 'Not recorded'}</dd></div><div><dt>Date of birth</dt><dd>{member.date_of_birth ? formatDate(member.date_of_birth) : 'Not recorded'}</dd></div><div><dt>Age</dt><dd>{age === null ? 'Not recorded' : `${age} years`}</dd></div><div><dt>Student ID</dt><dd>{member.student_id || 'Not recorded'}</dd></div><div><dt>Last visit</dt><dd>{visits[0] ? formatDate(visits[0].attendance_date) : 'No visits yet'}</dd></div></dl><div className="profile-remark"><span>REMARK</span><p>{member.remark || 'No notes yet.'}</p></div></Panel>
      <Panel title="Membership" action={!member.archived_at && <button className="text-button" onClick={onRenew}>Renew<RotateCw size={14} /></button>}>{membership ? <div className="membership-detail"><div className="package-mark"><ShieldCheck size={23} /></div><h3>{membership.package_snapshot.label}</h3><p>{membership.package_snapshot.access_notes}</p><dl className="detail-list"><div><dt>Start date</dt><dd>{formatDate(membership.start_date)}</dd></div><div><dt>End date</dt><dd>{formatDate(endDate(membership))}</dd></div><div><dt>Payment method</dt><dd>{membership.payment_method_label_snapshot || 'Not recorded'}</dd></div><div><dt>Voucher reference</dt><dd>{membership.voucher_reference || 'Not recorded'}</dd></div></dl>{membership.override_end_date && <div className="inline-notice"><Info size={16} /><span>Manual end date · {membership.override_reason}<br />Calculated: {formatDate(membership.calculated_end_date)}</span></div>}</div> : <EmptyState title="Ready for a membership" message="Add a package and start date to begin their membership history." action={!member.archived_at && <Button onClick={onRenew}>Add membership</Button>} />}</Panel>
      <button className="archive-button" onClick={onArchive}><Archive size={16} />{member.archived_at ? 'Restore member' : 'Archive member'}</button></div>
      <div className="stack"><Panel title="Monthly attendance" subtitle={`${monthVisits.length} ${monthVisits.length === 1 ? 'visit' : 'visits'} in ${formatDate(`${month}-01`, { day: undefined, month: 'long' })}`} action={<input className="month-input" type="month" aria-label="Profile attendance month" value={month} onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} />}><div className="attendance-calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: count }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const visit = monthVisits.find(a => a.attendance_date === date); return <div key={date} className={`calendar-day ${visit ? 'visited' : ''} ${date === today ? 'is-today' : ''} ${date > today ? 'future' : ''}`} aria-label={`${date}: ${visit ? 'Checked in' : 'No check-in recorded'}`}><span>{i + 1}</span>{visit ? <Check size={14} /> : <span className="calendar-dot" />}</div>; })}</div><div className="calendar-legend"><span><i />Checked in</span><span>Blank = no check-in recorded</span></div></Panel>
      <Panel title="Membership history" subtitle={`${history.length} records · each renewal stays connected`}><div className="history-list">{history.map(h => <div className="history-item" key={h.id}><div className="timeline-dot" /><div><strong>{h.package_snapshot.label}</strong><p>{formatDate(h.start_date)} <ArrowRight size={12} /> {formatDate(endDate(h))}</p><small>{h.payment_method_label_snapshot || 'Payment not recorded'}{h.override_end_date ? ' · Admin end date' : ''}</small></div><Badge>{membershipStatus(h, today)}</Badge></div>)}{!history.length && <EmptyState title="No membership history" message="New memberships and renewals will appear here." />}</div></Panel>
      {audit.length > 0 && <Panel title="Recent changes" subtitle="Prototype activity history"><div className="audit-list">{audit.map(a => <div key={a.id}><Activity size={15} /><div><strong>{a.action.replaceAll('.', ' ').replaceAll('_', ' ')}</strong><small>{formatDate(localDate(a.occurred_at))} · {formatTime(a.occurred_at)} · Demo Admin</small>{a.reason && <p>{a.reason}</p>}</div></div>)}</div></Panel>}</div></div>
  </>;
}

export function Analytics({ data, today, onExport }) {
  const [days, setDays] = useState(30);
  const start = shiftDays(today, 1 - days);
  const rows = attendanceInPeriod(data, start, today);
  const unique = new Set(rows.map(a => a.member_id)).size;
  const series = attendanceSeries(data, today, days);
  const busiest = [...series].sort((a, b) => b.visits - a.visits)[0];
  return <><div className="page-heading"><div><span className="eyebrow">UNDERSTAND YOUR COMMUNITY</span><h1>Attendance insights</h1><p>Small, useful details that help you see the bigger picture.</p></div><select aria-label="Analysis period" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select></div><div className="stats-grid three"><StatCard label="Total check-ins" value={rows.length} description={`${formatDate(start, { year: undefined })} – ${formatDate(today, { year: undefined })}`} icon={DoorOpen} accent /><StatCard label="Unique visitors" value={unique} description="Each person counted once in this period" icon={Users} /><StatCard label="Busiest day" value={busiest?.visits ? busiest.label : '—'} description={busiest?.visits ? `${busiest.visits} check-ins` : 'No check-ins in this period'} icon={Activity} /></div><div className="dashboard-middle"><Panel title="Daily attendance" subtitle="One recorded presence per member, per day"><AttendanceChart data={data} today={today} days={days} /></Panel><Panel title="Visits by category" subtitle="Category recorded at the time of each visit"><CategoryBreakdown data={data} rows={rows} attendance /></Panel></div><div className="directory-callout"><div className="callout-icon"><CalendarDays size={22} /></div><div><strong>Take these records with you.</strong><p>Export members, membership history and attendance into separate Excel sheets.</p></div><Button onClick={() => onExport({ start, end: today })}>Export this period<ArrowUpRight size={17} /></Button></div><p className="scope-note">These are sample-data counts. No absence rate, revenue or retention assumptions are included.</p></>;
}

export function Settings({ data, onReset }) {
  return <><div className="page-heading"><div><span className="eyebrow">A FOUNDATION TO BUILD ON</span><h1>Prototype settings</h1><p>Review the current package rules and what's coming next.</p></div></div><div className="settings-banner"><div className="callout-icon"><Info size={23} /></div><div><h2>You're exploring the UI prototype</h2><p>All people are fictional. Changes are saved only in this browser. Live accounts, permissions and shared data will be connected with Supabase after the UI review.</p></div></div><Panel title="Package catalogue" subtitle="Confirmed rules are kept separate from details still to be decided."><div className="table-scroll"><table className="member-table"><thead><tr><th>Package</th><th>Duration</th><th>Access details</th></tr></thead><tbody>{data.packages.map(p => <tr key={p.id}><td><strong>{p.label}</strong></td><td>{p.duration_months ? `${p.duration_months} calendar months` : <span className="pending-label">To be confirmed</span>}</td><td>{p.access_notes}</td></tr>)}</tbody></table></div></Panel><div className="settings-grid"><Panel title="Payment categories" subtitle="Sample options for UI review"><div className="settings-pills">{data.payment_methods.map(p => <span className="category-label" key={p.id}>{p.label}</span>)}</div><p className="settings-copy">Payment method only. No amounts, balances or revenue records.</p></Panel><Panel title="Before we go live" subtitle="The next decisions to make together"><ul className="next-list"><li>Required member fields and expiry-day entry rules</li><li>Reception / Admin access and devices</li><li>Supabase project, real data mapping and import review</li></ul></Panel></div><div className="reset-section"><div><strong>Start fresh with the sample data</strong><p>This resets only this prototype's local changes.</p></div><Button onClick={onReset}><RotateCw size={16} />Reset sample data</Button></div></>;
}
