import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { createPrototypeWorkbook } from '../src/prototype/export.js';

const runtimeRequire=createRequire(`${process.env.BUNDLED_NODE_MODULES}/../package.json`);
const {FileBlob,SpreadsheetFile}=await import(pathToFileURL(runtimeRequire.resolve('@oai/artifact-tool')).href);
const folder='.local-db/ui-checks';
await mkdir(folder,{recursive:true});
const data=createEmptyData();
data.members=Array.from({length:6},(_,index)=>({id:`export-${index}`,member_code:`C00${index+1}`,full_name:`Sample Member ${index+1}`,category_id:'customer',contact_phone:'091234567',remark:index===0?'Source dates preserved.':''}));
data.memberships=[{id:'membership',member_id:'export-0',package_snapshot:{label:'Gym'},plan_snapshot:{label:'1 month'},start_date:'2026-09-03',source_end_date:'2026-10-03',voucher_reference:'001234'}];
data.training_purchases=[{id:'training',member_id:'export-0',sessions:5,start_date:'2026-09-03',end_date:'2026-10-03'}];
data.attendance=data.members.flatMap((member,index)=>['01','03','05','06'].filter((_,day)=>(index+day)%3!==0).map(day=>({id:`${member.id}-${day}`,member_id:member.id,attendance_date:`2026-10-${day}`,member_category_snapshot:'Customer'})));
await writeFile(`${folder}/export-preview.xlsx`,createPrototypeWorkbook(data,{start:'2026-10-01',end:'2026-10-10'}));
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(`${folder}/export-preview.xlsx`));
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10}});
console.log(errors.ndjson);
const attendance=workbook.worksheets.getItem('Attendance').getRange('D3:M8').values;
assert.equal(attendance.flat().reduce((a,b)=>a+Number(b||0),0),data.attendance.length);
for (const [sheet,range] of [['Read me','A1:B14'],['Members','A1:H7'],['Memberships','A1:J2'],['Attendance','A1:M8'],['Training','A1:F2']]) {
  const preview=await workbook.render({sheetName:sheet,range,scale:1.5,format:'png'});
  await writeFile(`${folder}/export-${sheet.replaceAll(' ','-')}.png`,new Uint8Array(await preview.arrayBuffer()));
}
console.log('Export imported, presence total reconciled, all five sheet previews rendered. Synthetic data only.');
