import { useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button, Field } from './components.jsx';
import { BODY_METRICS, bodyFatPercent, measurementHistory, measurementSeries, monthLabel, validateMeasurement } from './bodyMeasurements.js';
import './bodyMeasurements.css';

const number = value => Number(value).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const chartStyle = { background:'var(--surface)', border:'1px solid var(--line)', borderRadius:6, color:'var(--ink)' };

function MeasurementEditor({ member, row, month, today, onSave, mutation }) {
  const initial=()=>Object.fromEntries(BODY_METRICS.slice(0,3).map(({key})=>[key,row?.[key] ?? '']));
  const [values,setValues]=useState(initial);
  const [error,setError]=useState('');
  const percent=values.weight_kg!=='' && values.fat_mass_kg!=='' ? bodyFatPercent(values.fat_mass_kg,values.weight_kg) : null;
  function submit(event) {
    event.preventDefault(); setError('');
    try {
      const payload={...values,measurement_month:`${month}-01`,member_id:member.id,id:row?.id || null,expected_updated_at:row?.updated_at || null};
      validateMeasurement(payload,today);
      onSave(payload);
    } catch(problem) { setError(problem.message); }
  }
  return <form className="measurement-form" onSubmit={submit}>
    <fieldset disabled={mutation.busy || Boolean(member.archived_at)}>
      <div className="measurement-inputs">{BODY_METRICS.slice(0,3).map(({key,label})=><Field key={key} label={`${label} (kg)`}><input type="number" inputMode="decimal" required min={key==='weight_kg'?'0.01':'0'} max="1000" step="0.01" value={values[key]} onChange={event=>setValues(current=>({...current,[key]:event.target.value}))}/></Field>)}
        <Field label="Body fat (%)"><input readOnly value={percent===null ? '' : number(percent)} /></Field>
      </div>
      <div className="measurement-form-actions"><span>{member.archived_at ? 'Archived member' : row ? 'Recorded month' : 'Not recorded'}</span><Button type="button" aria-label="Reset measurement inputs" title="Reset measurement inputs" onClick={()=>{setValues(initial());setError('');}}><RotateCcw size={16}/></Button><Button type="submit" variant="primary"><Save size={16}/>{mutation.busy ? 'Saving...' : row ? 'Save changes' : 'Save measurement'}</Button></div>
    </fieldset>
    {(error || mutation.error) && <p role="alert" className="form-error">{error || mutation.error}</p>}
  </form>;
}

function Trend({ rows, metrics, title, unit }) {
  return <section className="measurement-trend"><h3>{title}</h3><div className="measurement-chart-key">{metrics.map(metric=><span key={metric.key}><i style={{background:metric.color}}/>{metric.label}</span>)}</div>
    <div className="measurement-chart" role="img" aria-label={`${title}: ${rows.length} calendar months; missing months have no point. Values are listed in Monthly history.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{top:12,right:12,left:0,bottom:4}} accessibilityLayer><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="month" tick={{fill:'var(--muted)',fontSize:11}} tickLine={false} axisLine={false} minTickGap={32}/><YAxis width={44} domain={[0,'auto']} tick={{fill:'var(--muted)',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip contentStyle={chartStyle} formatter={(value,name)=>[`${number(value)} ${unit}`,name]}/>{metrics.map(metric=><Line key={metric.key} dataKey={metric.key} name={metric.label} type="linear" stroke={metric.color} strokeWidth={2} dot={{r:3}} activeDot={{r:5}} connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div>
  </section>;
}

export function BodyMeasurements({ data, member, today, onSave, onDelete, mutation = {busy:false,error:''} }) {
  const [month,setMonth]=useState(today.slice(0,7));
  const [range,setRange]=useState('12');
  const [page,setPage]=useState(0);
  const editor=useRef(null);
  const rows=measurementHistory(data,member.id);
  const row=rows.find(item=>item.measurement_month===`${month}-01`);
  const latest=rows.at(-1), previous=rows.at(-2);
  const series=measurementSeries(rows,Number(range));
  const descending=[...rows].reverse();
  const lastPage=Math.max(0,Math.ceil(rows.length/12)-1), currentPage=Math.min(page,lastPage);
  return <div className="body-measurements">
    <section className="measurement-entry" ref={editor}>
      <div className="measurement-section-heading"><h2>Monthly measurement</h2><Field label="Measurement month"><input type="month" required max={today.slice(0,7)} value={month} disabled={mutation.busy} onChange={event=>{const value=event.target.value;if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value<=today.slice(0,7)) setMonth(value);}}/></Field></div>
      <MeasurementEditor key={`${month}/${row?.id || 'new'}/${row?.updated_at || ''}`} member={member} row={row} month={month} today={today} onSave={onSave} mutation={mutation}/>
    </section>
    <section className="measurement-summary"><div className="measurement-section-heading"><h2>Latest measurements</h2><span>{latest ? monthLabel(latest.measurement_month) : 'No measurements recorded'}</span></div>
      <div className="measurement-metrics">{BODY_METRICS.map(metric=>{
        const delta=previous ? Math.round((Number(latest[metric.key])-Number(previous[metric.key]))*100)/100 : null;
        return <article key={metric.key} className="measurement-metric"><span>{metric.label}</span><strong>{latest ? number(latest[metric.key]) : '--'} <small>{metric.unit}</small></strong><p>{delta===null ? 'No comparison yet' : `${delta>0?'+':''}${number(delta)} ${metric.unit==='%'?'pp':'kg'} since ${monthLabel(previous.measurement_month)}`}</p></article>;
      })}</div>
    </section>
    {rows.length>0 && <section className="measurement-trends"><div className="measurement-section-heading"><h2>Monthly trends</h2><select aria-label="Measurement trend range" value={range} onChange={event=>setRange(event.target.value)}><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="0">All recorded months</option></select></div><div className="measurement-charts"><Trend rows={series} metrics={BODY_METRICS.slice(0,3)} title="Body composition" unit="kg"/><Trend rows={series} metrics={BODY_METRICS.slice(3)} title="Body fat percentage" unit="%"/></div></section>}
    <section className="measurement-history"><div className="measurement-section-heading"><h2>Monthly history</h2><span>{rows.length} recorded month{rows.length===1?'':'s'}</span></div>
      {rows.length ? <><div className="table-scroll"><table className="member-table"><thead><tr><th>Month</th>{BODY_METRICS.map(metric=><th key={metric.key}>{metric.label} ({metric.unit})</th>)}<th>Actions</th></tr></thead><tbody>{descending.slice(currentPage*12,currentPage*12+12).map(item=><tr key={item.id}><td>{monthLabel(item.measurement_month)}</td>{BODY_METRICS.map(metric=><td key={metric.key}>{number(item[metric.key])}</td>)}<td><div className="measurement-row-actions"><Button disabled={mutation.busy || Boolean(member.archived_at)} aria-label={`Edit measurement ${monthLabel(item.measurement_month)}`} title="Edit measurement" onClick={()=>{setMonth(item.measurement_month.slice(0,7));editor.current.scrollIntoView({block:'start',behavior:'smooth'});}}><Pencil size={16}/></Button><Button disabled={mutation.busy} aria-label={`Delete measurement ${monthLabel(item.measurement_month)}`} title="Delete measurement" onClick={()=>onDelete(item)}><Trash2 size={16}/></Button></div></td></tr>)}</tbody></table></div><div className="measurement-pagination"><span>Page {currentPage+1} of {lastPage+1}</span><Button aria-label="Previous measurements" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={16}/></Button><Button aria-label="Next measurements" disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}><ChevronRight size={16}/></Button></div></> : <p className="measurement-empty">No monthly measurements recorded.</p>}
    </section>
  </div>;
}
