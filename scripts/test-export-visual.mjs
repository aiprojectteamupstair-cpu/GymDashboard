import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { createPrototypeWorkbook } from '../src/prototype/export.js';
import { kgToLb } from '../src/prototype/bodyMeasurements.js';

const runtimeRequire=createRequire(`${process.env.BUNDLED_NODE_MODULES}/../package.json`);
const {FileBlob,SpreadsheetFile}=await import(pathToFileURL(runtimeRequire.resolve('@oai/artifact-tool')).href);
const folder='.local-db/ui-checks';
await mkdir(folder,{recursive:true});
const data=createEmptyData();
data.members=Array.from({length:6},(_,index)=>({id:`export-${index}`,member_code:`C00${index+1}`,full_name:`Sample Member ${index+1}`,category_id:'customer',contact_phone:'091234567',remark:index===0?'Source dates preserved.':''}));
data.memberships=[{id:'membership',member_id:'export-0',package_snapshot:{label:'Gym'},plan_snapshot:{label:'1 month'},start_date:'2026-09-03',source_end_date:'2026-10-03',voucher_reference:'001234'}];
data.training_purchases=[{id:'training',member_id:'export-0',sessions:5,start_date:'2026-09-03',end_date:'2026-10-03'}];
data.attendance=data.members.flatMap((member,index)=>['01','03','05','06'].filter((_,day)=>(index+day)%3!==0).map(day=>({id:`${member.id}-${day}`,member_id:member.id,attendance_date:`2026-10-${day}`,member_category_snapshot:'Customer'})));
data.body_measurements=[{id:'measurement-1',member_id:'export-0',measurement_month:'2026-10-01',weight_kg:80,fat_mass_kg:20,skeletal_muscle_kg:32,body_fat_percent:25},
  {id:'measurement-2',member_id:'export-1',measurement_month:'2026-10-01',weight_kg:62.5,fat_mass_kg:12.5,skeletal_muscle_kg:25,body_fat_percent:20}];
await writeFile(`${folder}/export-preview.xlsx`,createPrototypeWorkbook(data,{start:'2026-10-01',end:'2026-10-10'}));
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(`${folder}/export-preview.xlsx`));
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10}});
console.log(errors.ndjson);
const attendance=workbook.worksheets.getItem('Attendance').getRange('D3:M8').values;
assert.equal(attendance.flat().reduce((a,b)=>a+Number(b||0),0),data.attendance.length);
const bodyValues=workbook.worksheets.getItem('Body measurements').getRange('E2:H3').values;
for(const [index,record] of data.body_measurements.entries()) {
  assert.ok(Math.abs(bodyValues[index][0]-kgToLb(record.weight_kg))<1e-8);
  assert.ok(Math.abs(bodyValues[index][1]-kgToLb(record.fat_mass_kg))<1e-8);
  assert.equal(bodyValues[index][3],record.body_fat_percent);
}
for (const [sheet,range] of [['Read me','A1:B15'],['Members','A1:H7'],['Memberships','A1:J2'],['Attendance','A1:M8'],['Training','A1:F2'],['Body measurements','A1:H3']]) {
  const preview=await workbook.render({sheetName:sheet,range,scale:1.5,format:'png'});
  await writeFile(`${folder}/export-${sheet.replaceAll(' ','-')}.png`,new Uint8Array(await preview.arrayBuffer()));
}
console.log('Export imported, presence/measurement totals and formulas reconciled, all six sheet previews rendered. Synthetic data only.');
