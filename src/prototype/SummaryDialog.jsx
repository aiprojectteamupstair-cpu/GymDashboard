import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, SearchField } from './components.jsx';
import { categoryLabel, currentMembership, endDate, formatDate, formatTime, guestStatus, membershipStatus } from './domain.js';
import { dashboardGroups } from './insights.js';

const titles = { arrivals: "Today's check-ins", active: 'Active memberships', members: 'Registered members', expiring: 'Expiring soon', activity: 'New / Renew today' };
export function SummaryDialog({ data, today, kind, onClose, onProfile }) {
  const [query, setQuery] = useState('');
  const groups = dashboardGroups(data, today);
  const arrivalMap = new Map(groups.arrivals.map(a => [a.member_id, a]));
  if (kind === 'activity') return <ActivitySummary data={data} today={today} onClose={onClose} onProfile={onProfile}/>;
  if (['active', 'quiet10', 'quiet20', 'unvisited'].includes(kind)) return <EngagementSummary groups={groups} kind={kind} today={today} onClose={onClose} onProfile={onProfile}/>;
  const people = kind === 'arrivals' ? data.members.filter(m => arrivalMap.has(m.id)) : groups[kind];
  const rows = people.filter(m => [m.full_name, m.member_code, m.contact_phone].some(v => (v || '').toLowerCase().includes(query.toLowerCase())));
  return <Dialog title={titles[kind]} subtitle={`${people.length} people · ${kind === 'expiring' ? 'Membership ends today or in the next 14 days' : formatDate(today)}`} wide onClose={onClose}><div className="dialog-body"><SearchField value={query} onChange={setQuery} label="Search summary records" /><div className="table-scroll summary-table"><table className="member-table"><thead><tr><th>Member</th><th>{kind === 'arrivals' ? 'Check-in time' : 'End date'}</th><th>Status</th><th>Details</th></tr></thead><tbody>{rows.map(m => { const subscription = currentMembership(data, m.id, today); return <tr key={m.id}><td><strong>{m.full_name}</strong><small>{m.member_code} · {categoryLabel(data, m)}</small></td><td>{kind === 'arrivals' ? formatTime(arrivalMap.get(m.id).checked_in_at) : endDate(subscription) ? formatDate(endDate(subscription)) : '—'}</td><td><Badge>{m.category_id === 'guest' ? guestStatus(data, m, today) : membershipStatus(subscription, today)}</Badge></td><td><Button aria-label={`View ${m.full_name}`} onClick={() => onProfile(m.id)}><ArrowUpRight size={17} />Profile</Button></td></tr>; })}</tbody></table></div>{!rows.length && <EmptyState title="No matching records" message="Try another search or return to the dashboard." />}</div><div className="dialog-footer"><Button onClick={onClose}>Close</Button></div></Dialog>;
}
function EngagementSummary({groups,kind,today,onClose,onProfile}) {
  const [query,setQuery] = useState('');
  const names = {active:'All active members',quiet10:'No visit for 10–20 days',quiet20:'No visit for over 20 days',unvisited:'No recorded visit'};
  const rows = groups[kind].filter(m => [m.full_name,m.member_code,m.contact_phone].some(v => (v || '').toLowerCase().includes(query.toLowerCase())));
  return <Dialog title={names[kind]} subtitle={`${groups[kind].length} active members · ${formatDate(today)}`} wide onClose={onClose}><div className="dialog-body"><p className="scope-note">Yellow and red are subsets of all active members, not additional members. Days use the last recorded visit in Myanmar time. Members without a recorded visit are listed separately; missing records do not prove absence.</p><SearchField value={query} onChange={setQuery} label="Search attendance status"/><div className="table-scroll summary-table"><table className="member-table"><thead><tr><th>Member</th><th>Phone</th><th>Last visit</th><th>Days since visit</th><th>Details</th></tr></thead><tbody>{rows.map(m=><tr key={m.id}><td><strong>{m.full_name}</strong><small>{m.member_code}</small></td><td>{m.contact_phone || '—'}</td><td>{m.last_visit ? formatDate(m.last_visit) : 'No recorded visit'}</td><td>{m.days_since_visit ?? '—'}</td><td><Button onClick={()=>onProfile(m.id)}>Profile</Button></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="No matching members" message="Try another search."/>}</div><div className="dialog-footer"><Button onClick={onClose}>Close</Button></div></Dialog>;
}
function ActivitySummary({data,today,onClose,onProfile}) {
  const [query,setQuery]=useState('');
  const rows=dashboardGroups(data,today).activity;
  const visible=rows.filter(row=>{const m=data.members.find(m=>m.id===row.member_id);return [m?.full_name,m?.member_code].some(v=>(v||'').toLowerCase().includes(query.toLowerCase()));});
  return <Dialog title="New / Renew today" subtitle={rows.length+' membership records saved today · '+formatDate(today)} wide onClose={onClose}><div className="dialog-body"><SearchField value={query} onChange={setQuery} label="Search new and renewed members"/><div className="table-scroll summary-table"><table className="member-table"><thead><tr><th>Member</th><th>Type</th><th>Package / Plan</th><th>Saved at</th><th>Details</th></tr></thead><tbody>{visible.map(row=>{const m=data.members.find(m=>m.id===row.member_id);return <tr key={row.id}><td><strong>{m?.full_name || 'Unknown member'}</strong><small>{m?.member_code}</small></td><td>{row.activity_kind}</td><td>{row.package_snapshot.label}<small>{row.plan_snapshot?.label}</small></td><td>{formatTime(row.created_at)}</td><td><Button onClick={()=>onProfile(row.member_id)}>Profile</Button></td></tr>;})}</tbody></table></div>{!visible.length && <EmptyState title="No matching memberships" message="New memberships and renewals saved today appear here."/>}</div><div className="dialog-footer"><Button onClick={onClose}>Close</Button></div></Dialog>;
}
