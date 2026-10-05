import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='.private-imports/update-2026-10-03/';
const read=name=>JSON.parse(fs.readFileSync(dir+name));
const source=read('attendance-source.json'), master=read('members-source.json'), reconciliation=read('reconciliation-plan.json');
const existing=read('before-attendance-keys.json');
const mappings=reconciliation.mappings;
const byRow=new Map(mappings.map(row=>[row.original._row,row]));
const old=new Map(existing.map(row=>[`${row[0]}:${row[1]}`,row]));
const visits=new Map(), notes=[], reviews=[], summary=[];
const months={July:7,August:8,September:9,October:10};
for(const [sheet,month] of Object.entries(months)) {
  const rows=source.sheets[sheet],header=rows[5],totalColumn=header.indexOf('Total Days');
  assert.equal(header[0],'Member ID');assert.ok(totalColumn>3);
  const count=totalColumn-3;
  assert.deepEqual(header.slice(3,totalColumn),Array.from({length:count},(_,i)=>String(i+1).padStart(2,'0')));
  for(const [name,cell] of source.formula_cells.filter(([name])=>name===sheet)) {
    const [,letters,num]=cell.match(/^([A-Z]+)(\d+)$/);
    const column=[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
    assert.ok(!(Number(num)>=7&&Number(num)<=462&&column>=3&&column<totalColumn),`Formula in attendance mark ${name}!${cell}`);
  }
  let total=0;const daily=Array(count).fill(0);
  for(let i=6;i<462;i++) {
    const row=rows[i],member=master.sheets.Members[i-5],mapping=byRow.get(i-4);
    assert.deepEqual(row.slice(0,3),member.slice(0,3),'Attendance/master row identity mismatch');
    const marks=row.slice(3,totalColumn);
    assert.ok(marks.every(value=>[null,'',0,1].includes(value)),'Invalid presence mark');
    const days=marks.flatMap((value,index)=>value===1?[index+1]:[]);
    assert.equal(row[totalColumn],days.length,'Cached member total differs from source marks');
    total+=days.length;days.forEach(day=>daily[day-1]++);
    if(!mapping) {assert.equal(row[0],'C123');assert.equal(days.length,0);continue;}
    if(row[totalColumn+1])notes.push({member_id:mapping.member_id,sheet,row:i+1,note:row[totalColumn+1]});
    for(const day of days) {
      const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      assert.ok(date<='2026-10-03');
      const key=`${mapping.member_id}:${date}`;
      assert.ok(!visits.has(key),'Duplicate daily presence');
      const preConversion=mapping.previous_code&&date<'2026-09-28';
      visits.set(key,{member_id:mapping.member_id,date,code:preConversion?mapping.previous_code:mapping.member_code,category:preConversion?'Guest':mapping.original.Category||'Guest',sheet,row:i+1,source_code:row[0],original_name:row[1],original_category:row[2],link_method:mapping.link});
    }
  }
  assert.equal(rows[463][0],'Daily totals');assert.deepEqual(rows[463].slice(3,totalColumn),daily);
  assert.equal(rows[463][totalColumn],total);assert.equal(rows[3][3],total);assert.equal(rows[3][1],456);
  summary.push({sheet,marked:total});
}
for(let index=6;index<12;index++) {
  const [month,name,candidates,days,issue]=source.sheets.Review[index];
  const dates=days.split(',').map(day=>month.slice(0,7)+'-'+day.trim());
  const candidateCodes=candidates.split('/').map(code=>code.trim());
  const people=mappings.filter(mapping=>candidateCodes.includes(mapping.original['Member ID']));
  assert.ok(people.length);
  const resolved=candidates==='C123 / C124';
  const review={sheet:'Review',row:index+1,month:month.slice(0,7),name,candidates,dates,issue,resolved_by_prior_user_confirmation:resolved};
  reviews.push(review);
  for(const mapping of people)notes.push({member_id:mapping.member_id,sheet:'Review',row:index+1,note:`${month.slice(0,7)} dates ${days}: ${issue} ${resolved?'Prior user confirmation: deleted duplicate C123 remains excluded; dates belong to C124.':'Unconfirmed source evidence only; no new visits inferred and existing records retained.'}`});
  if(resolved) {
    const mapping=people.find(row=>row.member_code==='C124');assert.ok(mapping);
    for(const date of dates) {
      const key=`${mapping.member_id}:${date}`;
      assert.ok(!visits.has(key));
      visits.set(key,{member_id:mapping.member_id,date,code:mapping.member_code,category:'Customer',sheet:'Review',row:index+1,source_code:'C123 / C124',original_name:name,original_category:'Customer',link_method:'prior_user_confirmed_C124_duplicate_resolution'});
    }
  }
}
const additions=[],overlap=[],conflicts=[];
for(const [key,visit] of visits) {
  if(!old.has(key))additions.push(visit);
  else if(old.get(key)[3])conflicts.push({...visit,reason:'Existing visit is voided; preserved pending review'});
  else overlap.push(visit);
}
const notReconfirmed=existing.filter(row=>!row[3]&&row[1]<='2026-10-03'&&!visits.has(`${row[0]}:${row[1]}`));
for(const mapping of mappings) {
  const rows=notReconfirmed.filter(row=>row[0]===mapping.member_id);
  if(rows.length)notes.push({member_id:mapping.member_id,sheet:'Reconciliation',row:mapping.original._row,note:`Existing attendance not marked in the updated workbook: ${rows.map(row=>row[1]).sort().join(', ')}. Retained; blanks are not deletion instructions or confirmed absences.`});
}
const report={source:{file:source.file,sha256:source.sha256},summary,totalMarks:summary.reduce((n,s)=>n+s.marked,0),resolvedReviewDays:reviews.filter(r=>r.resolved_by_prior_user_confirmation).reduce((n,r)=>n+r.dates.length,0),overlap:overlap.length,additions:additions.length,notReconfirmed:notReconfirmed.length,conflicts:conflicts.length,additionsByMonth:Object.fromEntries(Object.values(months).map(month=>{const key=`2026-${String(month).padStart(2,'0')}`;return [key,additions.filter(row=>row.date.startsWith(key)).length];}))};
fs.writeFileSync(dir+'attendance-update-plan.json',JSON.stringify({report,additions,overlap,conflicts,notReconfirmed,notes,reviews},null,2));
console.log(JSON.stringify(report,null,2));
