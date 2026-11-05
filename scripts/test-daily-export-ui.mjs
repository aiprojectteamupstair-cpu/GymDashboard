import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();
const data=createEmptyData(),staff={id:'daily-export-staff',role_code:'admin',enabled:true,display_name:'Export fixture'};
data.members=[{id:'a',member_code:'S001',full_name:'Historical Customer',category_id:'student',previous_codes:[]},
  {id:'b',member_code:'E001',full_name:'Staff Member',category_id:'staff',previous_codes:[]}];
data.members.push({id:'expired',member_code:'C002',full_name:'Expired Before Period',category_id:'customer',previous_codes:[]});
data.memberships=[{id:'long-plan',member_id:'a',start_date:'2026-07-01',source_end_date:'2026-10-02',member_category_snapshot:'Customer',voucher_reference:'long-plan'},
  {id:'current-plan',member_id:'a',start_date:'2026-10-03',source_end_date:'2027-01-03',member_category_snapshot:'Customer',voucher_reference:'current-plan'},
  {id:'old-plan',member_id:'a',start_date:'2025-01-01',source_end_date:'2025-04-01',member_category_snapshot:'Customer',voucher_reference:'old-plan'},
  {id:'expired-plan',member_id:'expired',start_date:'2026-06-01',source_end_date:'2026-09-01',member_category_snapshot:'Customer',voucher_reference:'expired-plan'}];
data.attendance=['01','02'].flatMap(day=>data.members.slice(0,2).map(member=>({id:`${day}-${member.id}`,member_id:member.id,attendance_date:`2026-10-${day}`,member_category_snapshot:member.id==='a'?'Customer':'Staff',time_source:'import_date_only'})));
data.training_purchases=[{id:'bundled-pt',member_id:'a',membership_id:'current-plan',sessions:10,start_date:'2026-10-03'}];
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/local/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);
  assert.ok(['session','workspace'].includes(name),`Unexpected API: ${name}`);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(name==='session'?{user:staff}:{data,staff})});
});
try {
  await page.goto(`${process.env.UI_URL || 'http://127.0.0.1:3000'}/analytics`);
  await page.getByRole('heading',{name:'Analytics',exact:true}).waitFor();
  await page.getByLabel('Analysis start date',{exact:true}).fill('01/10/2026');
  await page.getByLabel('Analysis end date',{exact:true}).fill('03/10/2026');
  // Capture the actual browser-produced workbook, independent of OS download policy.
  await page.evaluate(()=>{
    const original=URL.createObjectURL;
    URL.createObjectURL=blob=>{window.dailyExport=blob;return original(blob);};
    document.addEventListener('click',event=>{if(event.target.closest('a[download]')) event.preventDefault();});
  });
  await mkdir('.local-db/ui-checks',{recursive:true});
  for(const [category,expected] of [['all',[2,2,0]],['customer',[1,1,0]],['staff',[1,1,0]]]) {
    await page.getByLabel('Analysis category',{exact:true}).selectOption(category);
    await page.evaluate(()=>{window.dailyExport=null;});
    await page.getByRole('button',{name:'Export Excel',exact:true}).click();
    await page.waitForFunction(()=>window.dailyExport instanceof Blob);
    const bytes=Uint8Array.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.dailyExport.arrayBuffer()))));
    const zip=unzipSync(bytes),sheet=strFromU8(zip['xl/worksheets/sheet7.xml']);
    const members=strFromU8(zip['xl/worksheets/sheet2.xml']),memberships=strFromU8(zip['xl/worksheets/sheet3.xml']);
    assert.doesNotMatch(members,/Profile status|Expired Before Period/);
    assert.doesNotMatch(memberships,/old-plan|expired-plan/);
    assert.equal((members.match(/<row /g)||[]).length,category==='staff'?1:2);
    assert.equal((memberships.match(/<row /g)||[]).length,category==='staff'?1:3);
    if(category!=='staff') { assert.match(memberships,/long-plan/);assert.match(memberships,/current-plan/); }
    assert.equal((strFromU8(zip['xl/workbook.xml']).match(/<sheet /g)||[]).length,8);
    const sales=strFromU8(zip['xl/worksheets/sheet8.xml']);
    assert.equal((sales.match(/<row /g)||[]).length,category==='staff'?1:3);
    assert.doesNotMatch(sales,/long-plan|old-plan|expired-plan/);
    if(category!=='staff') assert.match(sales,/bundled-pt/);
    assert.equal((sheet.match(/<row /g)||[]).length,4);
    for(const [index,total] of expected.entries()) assert.match(sheet,new RegExp(`<c r="B${index+2}"[^>]*><f>SUM\\(C${index+2}:G${index+2}\\)</f><v>${total}</v>`));
    if(category==='all') await writeFile('.local-db/ui-checks/daily-attendance-browser-export.xlsx',bytes);
  }
  assert.deepEqual(errors,[]);
  console.log('Analytics export verified: eight sheets, period membership and PT sales, category filters and daily attendance.');
} finally {await browser.close();}
