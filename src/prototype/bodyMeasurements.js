import { addMonths, localDate, validDate } from './domain.js';

export const BODY_METRICS = [
  { key:'weight_kg', label:'Weight', unit:'kg', color:'#c8102e' },
  { key:'fat_mass_kg', label:'Fat mass', unit:'kg', color:'#b67b16' },
  { key:'skeletal_muscle_kg', label:'Skeletal muscle', unit:'kg', color:'#258575' },
  { key:'body_fat_percent', label:'Body fat', unit:'%', color:'#6574bb' },
];

export const monthLabel = month => new Intl.DateTimeFormat('en-GB', { month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(`${month.slice(0,7)}-01T00:00:00Z`));
export const bodyFatPercent = (fat, weight) => Number.isFinite(Number(fat)) && Number(weight)>0 ? Math.round((Number(fat)*100/Number(weight)+Number.EPSILON)*100)/100 : null;

export function validateMeasurement(input, today = localDate()) {
  if (!/^\d{4}-\d{2}-01$/.test(input.measurement_month || '') || !validDate(input.measurement_month) || input.measurement_month.slice(0,7)>today.slice(0,7)) throw new Error('Choose a valid month, no later than this month.');
  const result = { measurement_month:input.measurement_month };
  for (const {key,label} of BODY_METRICS.slice(0,3)) {
    const raw = input[key];
    if (!['string','number'].includes(typeof raw) || !/^\d+(\.\d{1,2})?$/.test(String(raw).trim())) throw new Error(`Enter ${label.toLowerCase()} in kg with up to two decimal places.`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value<0 || value>1000 || (key==='weight_kg' && value===0)) throw new Error(`${label} is outside the allowed range.`);
    result[key]=value;
  }
  if (result.fat_mass_kg>result.weight_kg || result.skeletal_muscle_kg>result.weight_kg) throw new Error('Fat mass and skeletal muscle cannot exceed weight.');
  result.body_fat_percent=bodyFatPercent(result.fat_mass_kg,result.weight_kg);
  return result;
}

export function applyBodyMeasurement(data, input, actor, now, remove = false) {
  if (!['super_admin','admin'].includes(actor?.role)) throw new Error('An authorized Admin or Staff account is required.');
  const member=data.members.find(row=>row.id===input.member_id);
  if (!member) throw new Error('Member not found.');
  const existing=input.id ? data.body_measurements.find(row=>row.id===input.id && row.member_id===member.id && !row.deleted_at) : null;
  if (input.id && (!existing || existing.updated_at!==input.expected_updated_at)) throw new Error('Measurement changed. Refresh and reopen it before editing.');
  const before=existing ? structuredClone(existing) : null;
  if (existing && now<=existing.updated_at) now=new Date(Date.parse(existing.updated_at)+1).toISOString();
  let row;
  if (remove) {
    if (!existing) throw new Error('Measurement not found.');
    row={...existing,deleted_at:now,updated_at:now,updated_by:actor.id};
  } else {
    if (member.archived_at) throw new Error('Restore the member before adding or editing measurements.');
    const values=validateMeasurement(input,localDate(now));
    if (existing && existing.measurement_month!==values.measurement_month) throw new Error('An existing measurement must keep its original month.');
    if (data.body_measurements.some(item=>item.member_id===member.id && item.measurement_month===values.measurement_month && !item.deleted_at && item.id!==existing?.id)) throw new Error('This month already has measurements. Refresh and edit that entry.');
    row={...(existing || {id:crypto.randomUUID(),member_id:member.id,created_at:now,created_by:actor.id,deleted_at:null}),...values,updated_at:now,updated_by:actor.id};
  }
  if (existing) data.body_measurements=data.body_measurements.map(item=>item.id===row.id ? row : item);
  else data.body_measurements.push(row);
  return {entity_type:'body_measurements',entity_id:row.id,measurement_id:row.id,member_id:member.id,changes:{before,after:structuredClone(row)}};
}

export function measurementHistory(data, memberId) {
  return (data.body_measurements || []).filter(row=>row.member_id===memberId && !row.deleted_at).sort((a,b)=>a.measurement_month.localeCompare(b.measurement_month));
}

export function measurementSeries(rows, months = 12) {
  if (!rows.length) return [];
  const last=rows.at(-1).measurement_month;
  const start=new Date(`${last}T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth()-(months-1));
  const cutoff=months ? start.toISOString().slice(0,10) : rows[0].measurement_month;
  const first=cutoff>rows[0].measurement_month ? cutoff : rows[0].measurement_month;
  const byMonth=new Map(rows.map(row=>[row.measurement_month,row]));
  const result=[];
  for(let month=first;month<=last;month=addMonths(month,1)) {
    const row=byMonth.get(month);
    result.push({month:monthLabel(month),...Object.fromEntries(BODY_METRICS.map(({key})=>[key,row ? Number(row[key]) : null]))});
  }
  return result;
}
