import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { createPrototypeWorkbook } from '../src/prototype/export.js';
import { kgToLb } from '../src/prototype/bodyMeasurements.js';
import readXlsx from 'read-excel-file/node';

const runtimeRequire=createRequire(`${process.env.BUNDLED_NODE_MODULES}/../package.json`);
const {FileBlob,SpreadsheetFile}=await import(pathToFileURL(runtimeRequire.resolve('@oai/artifact-tool')).href);
const folder='.local-db/ui-checks';
await mkdir(folder,{recursive:true});
const data=createEmptyData();
data.members=Array.from({length:6},(_,index)=>({id:`export-${index}`,member_code:`C00${index+1}`,full_name:`Sample Member ${index+1}`,category_id:'customer',contact_phone:'091234567',remark:index===0?'Source dates preserved.':''}));
data.memberships=[{id:'membership',member_id:'export-0',package_snapshot:{label:'Gym'},plan_snapshot:{label:'1 month'},start_date:'2026-09-03',source_end_date:'2026-10-03',voucher_reference:'001234'}];
data.memberships.push({id:'long-plan',member_id:'export-1',package_snapshot:{label:'Gym'},plan_snapshot:{label:'1 year'},start_date:'2026-01-01',source_end_date:'2027-01-01',voucher_reference:'001235'},
  {id:'old-plan',member_id:'export-1',start_date:'2025-01-01',source_end_date:'2025-12-31',voucher_reference:'excluded-old'},
  {id:'unknown-plan',member_id:'export-2',start_date:null,source_end_date:'2026-12-01'});
data.memberships.push({id:'sale',member_id:'export-1',transaction_kind:'Renew',package_snapshot:{label:'Gym'},plan_snapshot:{label:'1 month'},start_date:'2026-10-10',source_end_date:'2026-11-10',voucher_reference:'00042'});
data.training_purchases=[{id:'training',member_id:'export-1',membership_id:'sale',sessions:5,start_date:'2026-10-10',end_date:'2026-11-10'}];
data.attendance=data.members.flatMap((member,index)=>['01','03','05','06'].filter((_,day)=>(index+day)%3!==0).map(day=>({id:`${member.id}-${day}`,member_id:member.id,attendance_date:`2026-10-${day}`,member_category_snapshot:['VIP Customer','Customer','Student','Staff','Guest','Customer'][index]})));
data.body_measurements=[{id:'measurement-1',member_id:'export-0',measurement_month:'2026-10-01',weight_kg:80,fat_mass_kg:20,skeletal_muscle_kg:32,body_fat_percent:25},
  {id:'measurement-2',member_id:'export-1',measurement_month:'2026-10-01',weight_kg:62.5,fat_mass_kg:12.5,skeletal_muscle_kg:25,body_fat_percent:20}];
await writeFile(`${folder}/export-preview.xlsx`,createPrototypeWorkbook(data,{start:'2026-10-01',end:'2026-10-10'}));
const savedSheets=await readXlsx(`${folder}/export-preview.xlsx`);
assert.equal(savedSheets.find(sheet=>sheet.sheet==='Members').data[1][3],'091234567');
assert.equal(savedSheets.find(sheet=>sheet.sheet==='Memberships').data[1][8],'001234');
const saleRows=savedSheets.find(sheet=>sheet.sheet==='Sale').data.slice(1);
assert.deepEqual(saleRows.map(row=>[row[1],row[2],row[10],row[11]]),[['Membership','C002','00042','sale'],['PT','C002','00042','training']]);
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(`${folder}/export-preview.xlsx`));
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10}});
console.log(errors.ndjson);
const attendance=workbook.worksheets.getItem('Attendance').getRange('D3:M8').values;
assert.deepEqual(workbook.worksheets.getItem('Members').getRange('A2:A3').values,[['C001'],['C002']]);
assert.equal(workbook.worksheets.getItem('Members').getRange('A4').values[0][0],null);
assert.deepEqual(workbook.worksheets.getItem('Memberships').getRange('H2:I3').values,[['Expired','001234'],['Active','001235']]);
assert.equal(attendance.flat().reduce((a,b)=>a+Number(b||0),0),data.attendance.length);
const bodyValues=workbook.worksheets.getItem('Body measurements').getRange('E2:H3').values;
for(const [index,record] of data.body_measurements.entries()) {
  assert.ok(Math.abs(bodyValues[index][0]-kgToLb(record.weight_kg))<1e-8);
  assert.ok(Math.abs(bodyValues[index][1]-kgToLb(record.fat_mass_kg))<1e-8);
  assert.equal(bodyValues[index][3],record.body_fat_percent);
}
const daily=workbook.worksheets.getItem('Daily attendance').getRange('B2:G11').values;
assert.equal(daily.reduce((sum,row)=>sum+row[0],0),data.attendance.length);
for(const [index,row] of daily.entries()) {
  assert.equal(row[0],row.slice(1).reduce((sum,count)=>sum+count,0));
  assert.equal(row[0],attendance.reduce((sum,member)=>sum+Number(member[index]||0),0));
}
assert.equal(daily[1][0],0);
for (const [sheet,range] of [['Read me','A1:B22'],['Members','A1:G3'],['Memberships','A1:J4'],['Attendance','A1:M8'],['Training','A1:F2'],['Body measurements','A1:H3'],['Daily attendance','A1:G11'],['Sale','A1:L3']]) {
  const preview=await workbook.render({sheetName:sheet,range,scale:1.5,format:'png'});
  await writeFile(`${folder}/export-${sheet.replaceAll(' ','-')}.png`,new Uint8Array(await preview.arrayBuffer()));
}
console.log('Export imported and reconciled, eight sheet previews rendered. Synthetic data only.');
