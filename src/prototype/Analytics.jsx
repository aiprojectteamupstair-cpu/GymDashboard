import { useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, Download, Repeat2, Users, Footprints } from 'lucide-react';
import { Button, Panel, StatCard } from './components.jsx';
import { formatDate, shiftDays, validDate } from './domain.js';
import { attendanceInsights, deltaLabel } from './insights.js';

const tick = { fill: 'var(--muted)', fontSize: 12 };
const tooltip = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 14 };

function Bars({ rows, field, name, label }) {
  return <div className="insight-chart" role="img" aria-label={`${label}. ${rows.map(r => `${r.name}: ${Number(r[field]).toFixed(field === 'average' ? 1 : 0)}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 12, right: 12, left: -18, bottom: 4 }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} minTickGap={15} /><YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={field === 'average'} /><Tooltip contentStyle={tooltip} cursor={{ fill: 'var(--surface-alt)' }} formatter={value => [Number(value).toFixed(field === 'average' ? 1 : 0), name]} /><Bar dataKey={field} name={name} fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={42} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>;
}

export function Analytics({ data, today, onExport }) {
  const [start, setStart] = useState(() => shiftDays(today, -30));
  const [end, setEnd] = useState(() => shiftDays(today, -1));
  const [category, setCategory] = useState('all');
  const days = Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  const valid = validDate(start) && validDate(end) && days>0 && days<=366 && end<=today;
  const insight = attendanceInsights(data, valid ? start : shiftDays(today,-30), valid ? end : shiftDays(today,-1), category);
  const visibleHours = insight.hours.filter((r, i) => r.visits || (i >= 6 && i <= 21));
  const bestDay = [...insight.weekdays].sort((a, b) => b.average - a.average)[0];
  return <>
    <div className="page-heading"><h1 className="screen-title"><Activity aria-hidden="true"/>Analytics</h1><Button disabled={!valid} onClick={() => onExport({ start, end, category })}><Download size={18} />Export Excel</Button></div>
    <div className="analytics-filters"><div><strong>{formatDate(start)} – {formatDate(end)}</strong><span>Compared with {formatDate(insight.previousStart)} – {formatDate(insight.previousEnd)}</span></div><label>From<input type="date" aria-label="Analysis start date" value={start} max={end || today} onChange={e=>{setStart(e.target.value);}}/></label><label>To<input type="date" aria-label="Analysis end date" value={end} min={start} max={today} onChange={e=>{setEnd(e.target.value);}}/></label><label>Category at visit<select aria-label="Analysis category" value={category} onChange={e => {setCategory(e.target.value);}}><option value="all">All categories</option>{data.member_categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div>
    {!valid && <p className="form-error" role="alert">Choose valid dates in order, up to 366 days, ending no later than today.</p>}
    {valid && <>
    {end === today && <p className="scope-note">Today is still in progress; comparison includes a partial day.</p>}
    <div className="stats-grid"><StatCard label="Recorded visits" value={insight.visits} description={deltaLabel(insight.visits, insight.previous.visits)} icon={Footprints} accent /><StatCard label="Unique visitors" value={insight.unique} description={deltaLabel(insight.unique, insight.previous.unique)} icon={Users} /><StatCard label="Visits per visitor" value={insight.average === null ? '—' : insight.average.toFixed(1)} description="Recorded visits ÷ unique visitors" icon={Activity} /><StatCard label="Repeat visitors" value={insight.repeatRate === null ? '—' : `${insight.repeatRate.toFixed(0)}%`} description={`${insight.repeat} of ${insight.unique} visitors came 2+ days`} icon={Repeat2} /></div>
    {!insight.visits && <div className="inline-notice">No recorded visits for this category and period. Select a different period to explore.</div>}
    <Panel title="How is attendance changing?" subtitle="Daily visits, aligned with the previous period" className="analytics-trend"><div className="chart-key"><span><i />Selected period</span><span><i className="comparison-key" />Previous period</span></div><div className="insight-chart trend-chart" role="img" aria-label={`Daily visit comparison. ${insight.series.map(r => `${r.label}: ${r.visits}, previous ${r.previous}`).join('; ')}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={insight.series} margin={{ top: 10, right: 18, left: -18, bottom: 0 }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="label" interval="preserveStartEnd" tick={tick} axisLine={false} tickLine={false} minTickGap={40} /><YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltip} /><Line dataKey="visits" name="Selected period" stroke="var(--accent)" strokeWidth={3} dot={false} isAnimationActive={false} /><Line dataKey="previous" name="Previous period" stroke="var(--comparison)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></Panel>
    <div className="analytics-grid"><Panel title="Which days are busiest?" subtitle="Average recorded visits per occurrence of each weekday"><Bars rows={insight.weekdays} field="average" name="Average visits" label="Weekday attendance averages" /><div className="soft-note">{insight.visits ? `${bestDay.name} has the highest average: ${bestDay.average.toFixed(1)} visits.` : 'No recorded visits in this period.'}</div></Panel><Panel title="When do people arrive?" subtitle="Check-ins by Myanmar local hour"><Bars rows={visibleHours} field="visits" name="Check-ins" label="Arrival hours" /><div className="soft-note">Arrival times show demand at reception, not live gym occupancy. {insight.unknownTimeVisits > 0 && `${insight.unknownTimeVisits} visits with unknown/assumed times are excluded from this chart.`}</div></Panel></div>
    <details className="metric-definitions"><summary>How these metrics are calculated</summary><p>One valid presence per person per Myanmar day. Unique visitors are distinct people; repeat visitors attended at least two days within the selected period. These are engagement measures, not membership retention rates.</p><p>Weekday averages include every occurrence of that weekday, including days with no recorded visit. The dashboard covers today; analytics uses your selected dates. Missing historical check-ins can understate totals.</p></details>
    </>}
  </>;
}
