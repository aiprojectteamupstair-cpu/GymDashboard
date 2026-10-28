import { useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, Droplets, Dumbbell, Minus, Pencil, Percent, RotateCcw, Save, Scale, Trash2 } from 'lucide-react';
import { Button, Field } from './components.jsx';
import { BODY_METRICS, measurementHistory, measurementInputs, measurementSeries, measurementValue, monthLabel, validateMeasurement } from './bodyMeasurements.js';
import './bodyMeasurements.css';

const number = value => Number(value).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const metricIcons = [Scale,Droplets,Dumbbell,Percent];
const chartStyle = { background:'var(--surface)', border:'1px solid var(--line)', borderRadius:6, color:'var(--ink)' };
const deltaValue = (latest, baseline, metric) => latest && baseline ? Math.round((measurementValue(latest,metric)-measurementValue(baseline,metric))*100)/100 : null;
const deltaText = (value, metric) => `${value>0?'+':''}${number(value)} ${metric.unit==='%'?'pp':'lb'}`;

function MeasurementEditor({ member, row, month, today, onSave, mutation }) {
  const [values,setValues]=useState(()=>measurementInputs(row));
  const [error,setError]=useState('');
  const payload={...values,measurement_unit:'lb',measurement_month:`${month}-01`,member_id:member.id,id:row?.id || null,expected_updated_at:row?.updated_at || null};
  let percent=null;
  try { percent=validateMeasurement(payload,today,row).body_fat_percent; } catch { /* Incomplete inputs have no calculated result. */ }
  function submit(event) {
    event.preventDefault(); setError('');
    try { validateMeasurement(payload,today,row);onSave(payload); }
    catch(problem) { setError(problem.message); }
  }
  return <form className="measurement-form" onSubmit={submit}>
    <fieldset disabled={mutation.busy || Boolean(member.archived_at)}>
      <div className="measurement-inputs">{BODY_METRICS.slice(0,3).map(({inputKey,label})=><Field key={inputKey} label={`${label} (lb)`}>
        <input type="number" inputMode="decimal" required min={inputKey==='weight_lb'?'0.01':'0'} max="2204.62" step="0.01" placeholder="0.00" value={values[inputKey]} onChange={event=>setValues(current=>({...current,[inputKey]:event.target.value}))}/>
      </Field>)}
        <Field label="Body fat (%)" className="measurement-calculated"><input readOnly title="Fat mass / weight x 100" value={percent===null ? '' : number(percent)} placeholder="--"/></Field>
      </div>
      <div className="measurement-form-actions"><Button type="button" aria-label="Reset measurement inputs" title="Reset measurement inputs" onClick={()=>{setValues(measurementInputs(row));setError('');}}><RotateCcw size={16}/></Button><Button type="submit" variant="primary"><Save size={16}/>{mutation.busy ? 'Saving...' : row ? 'Save changes' : 'Save measurement'}</Button></div>
    </fieldset>
    {(error || mutation.error) && <p role="alert" className="form-error">{error || mutation.error}</p>}
  </form>;
}

function MetricCard({ metric, index, latest, baseline, series, selected, onSelect }) {
  const Icon=metricIcons[index];
  const delta=deltaValue(latest,baseline,metric);
  const ChangeIcon=delta===null || delta===0 ? Minus : delta>0 ? ArrowUpRight : ArrowDownRight;
  return <button type="button" className={`measurement-metric ${selected?'measurement-metric-selected':''}`} style={{'--metric-color':metric.color}} aria-label={`View ${metric.label.toLowerCase()} trend`} aria-pressed={selected} onClick={onSelect}>
    <span className="measurement-metric-label"><span>{metric.label}</span><Icon size={17}/></span>
    <strong>{latest ? number(measurementValue(latest,metric)) : '--'} <small>{metric.unit}</small></strong>
    <span className="measurement-card-change"><ChangeIcon size={15}/>{delta===null ? 'No comparison yet' : deltaText(delta,metric)}</span>
    <span className="measurement-card-baseline">{baseline ? `from ${monthLabel(baseline.measurement_month)}` : latest ? 'First recorded month' : 'Not recorded'}</span>
    <div className="measurement-sparkline" aria-hidden="true">{latest && <ResponsiveContainer width="100%" height="100%"><LineChart data={series.slice(-6)} margin={{top:5,right:4,bottom:5,left:4}} accessibilityLayer={false}><Line dataKey={metric.key} stroke={metric.color} strokeWidth={1.8} dot={{r:2,fill:metric.color,strokeWidth:0}} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer>}</div>
  </button>;
}

function MeasurementTrend({ series, metric, latest, first, range, onRange, recorded }) {
  const change=deltaValue(latest,first,metric);
  return <section className="measurement-trends">
    <div className="measurement-section-heading"><div><h2>{metric.label} trend</h2><span className="measurement-period">{first ? `${monthLabel(first.measurement_month)} - ${monthLabel(latest.measurement_month)}` : 'Monthly history'}</span></div><select aria-label="Measurement trend range" value={range} onChange={event=>onRange(event.target.value)}><option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="0">All months</option></select></div>
    <div className="measurement-chart-caption"><span><i style={{background:metric.color}}/>{metric.label} ({metric.unit})</span><span>{recorded} recorded / {series.length} months</span></div>
    <div className="measurement-chart" role="img" aria-label={`${metric.label} trend in ${metric.unit}. Missing months have no point; exact values are in Monthly history.`}>
      {latest ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{top:16,right:18,left:0,bottom:8}} accessibilityLayer>
        <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="month" tick={{fill:'var(--muted)',fontSize:11}} tickLine={false} axisLine={false} minTickGap={32}/><YAxis width={50} domain={metric.unit==='%'?[0,100]:[0,'auto']} tick={{fill:'var(--muted)',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip contentStyle={chartStyle} formatter={value=>[`${number(value)} ${metric.unit}`,metric.label]}/>
        <Area dataKey={metric.key} name={metric.label} type="linear" stroke={metric.color} strokeWidth={2.5} fill={metric.color} fillOpacity={0.07} dot={{r:3.5,fill:'var(--surface)',strokeWidth:2}} activeDot={{r:5}} connectNulls={false} isAnimationActive={false}/>
      </AreaChart></ResponsiveContainer> : <div className="measurement-chart-empty"><ChartNoAxesCombined size={34} strokeWidth={1.3}/><strong>No measurements recorded</strong><span>Monthly trend</span></div>}
    </div>
    <dl className="measurement-trend-summary"><div><dt>First in period</dt><dd>{first ? number(measurementValue(first,metric)) : '--'} <small>{metric.unit}</small></dd></div><div><dt>Latest in period</dt><dd>{latest ? number(measurementValue(latest,metric)) : '--'} <small>{metric.unit}</small></dd></div><div><dt>Period change</dt><dd>{change===null ? '--' : deltaText(change,metric)}</dd></div></dl>
  </section>;
}

export function BodyMeasurements({ data, member, today, onSave, onDelete, mutation = {busy:false,error:''} }) {
  const [month,setMonth]=useState(today.slice(0,7));
  const [range,setRange]=useState('12');
  const [comparison,setComparison]=useState('previous');
  const [metricKey,setMetricKey]=useState('weight_kg');
  const [page,setPage]=useState(0);
  const editor=useRef(null);
  const rows=measurementHistory(data,member.id);
  const row=rows.find(item=>item.measurement_month===`${month}-01`);
  const latest=rows.at(-1), baseline=rows.length>1 ? comparison==='first'?rows[0]:rows.at(-2) : null;
  const series=measurementSeries(rows,Number(range)).map(item=>({...item,...Object.fromEntries(BODY_METRICS.map(metric=>[metric.key,item[metric.key]===null?null:measurementValue(item,metric)]))}));
  const periodRows=series.length ? rows.filter(item=>item.measurement_month>=series[0].date) : [];
  const metric=BODY_METRICS.find(item=>item.key===metricKey);
  const descending=[...rows].reverse();
  const lastPage=Math.max(0,Math.ceil(rows.length/12)-1), currentPage=Math.min(page,lastPage);
  function edit(item) {setMonth(item.measurement_month.slice(0,7));editor.current.scrollIntoView({block:'center',behavior:'smooth'});}
  return <div className="body-measurements">
    <section className="measurement-summary">
      <div className="measurement-section-heading"><div><h2>Latest measurements</h2><span className="measurement-period"><CalendarDays size={14}/>{latest ? monthLabel(latest.measurement_month) : 'No recorded month'}<span className="measurement-period-divider"/>{rows.length} monthly records</span></div><select aria-label="Compare measurements" value={comparison} onChange={event=>setComparison(event.target.value)}><option value="previous">vs previous record</option><option value="first">vs first record</option></select></div>
      <div className="measurement-metrics">{BODY_METRICS.map((item,index)=><MetricCard key={item.key} metric={item} index={index} latest={latest} baseline={baseline} series={series} selected={metricKey===item.key} onSelect={()=>setMetricKey(item.key)}/>)}</div>
    </section>
    <div className="measurement-workspace">
      <MeasurementTrend series={series} metric={metric} latest={latest} first={periodRows[0]} range={range} onRange={setRange} recorded={periodRows.length}/>
      <section className="measurement-entry" ref={editor}>
        <div className="measurement-entry-heading"><span className="measurement-entry-icon"><Activity size={18}/></span><div><h2>Monthly measurement</h2><span className={`measurement-entry-status ${row?'is-recorded':''}`}>{member.archived_at ? 'Archived member' : row ? 'Recorded' : 'New entry'}</span></div></div>
        <Field label="Measurement month"><input type="month" required max={today.slice(0,7)} value={month} disabled={mutation.busy} onChange={event=>{const value=event.target.value;if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value<=today.slice(0,7)) setMonth(value);}}/></Field>
        <MeasurementEditor key={`${month}/${row?.id || 'new'}/${row?.updated_at || ''}`} member={member} row={row} month={month} today={today} onSave={onSave} mutation={mutation}/>
      </section>
    </div>
    <section className="measurement-history"><div className="measurement-section-heading"><h2>Monthly history</h2><span>{rows.length} recorded month{rows.length===1?'':'s'}</span></div>
      {rows.length ? <><div className="table-scroll"><table className="member-table"><thead><tr><th>Month</th>{BODY_METRICS.map(item=><th key={item.key}>{item.label} ({item.unit})</th>)}<th>Actions</th></tr></thead><tbody>{descending.slice(currentPage*12,currentPage*12+12).map(item=><tr key={item.id} className={row?.id===item.id?'measurement-selected-row':''}><td><strong>{monthLabel(item.measurement_month)}</strong>{item.id===latest.id && <small>Latest</small>}</td>{BODY_METRICS.map(metric=><td key={metric.key} className={metric.key===metricKey?'measurement-emphasis':''}>{number(measurementValue(item,metric))}</td>)}<td><div className="measurement-row-actions"><Button disabled={mutation.busy || Boolean(member.archived_at)} aria-label={`Edit measurement ${monthLabel(item.measurement_month)}`} title="Edit measurement" onClick={()=>edit(item)}><Pencil size={16}/></Button><Button disabled={mutation.busy} aria-label={`Delete measurement ${monthLabel(item.measurement_month)}`} title="Delete measurement" onClick={()=>onDelete(item)}><Trash2 size={16}/></Button></div></td></tr>)}</tbody></table></div><div className="measurement-pagination"><span>{currentPage*12+1}-{Math.min((currentPage+1)*12,rows.length)} of {rows.length}</span><Button aria-label="Previous measurements" title="Previous measurements" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={16}/></Button><Button aria-label="Next measurements" title="Next measurements" disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}><ChevronRight size={16}/></Button></div></> : <p className="measurement-empty">No monthly measurements recorded.</p>}
    </section>
  </div>;
}
