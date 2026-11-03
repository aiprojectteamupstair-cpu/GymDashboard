import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { createPrototypeWorkbook, exportTables } from '../src/prototype/export.js';

function fixture() {
  const data=createEmptyData();
  data.members=[{id:'a',member_code:'S001',full_name:'Changed category',category_id:'student'},
    {id:'b',member_code:'E001',full_name:'Staff fixture',category_id:'staff',archived_at:'2026-11-01'}];
  const visit=(id,member_id,attendance_date,member_category_snapshot,extra={})=>({id,member_id,attendance_date,member_category_snapshot,...extra});
  data.attendance=[
    visit('a1','a','2026-10-01','Customer'),
    visit('a1-duplicate','a','2026-10-01','Customer'),
    visit('b1','b','2026-10-01','Staff',{time_source:'import_date_only'}),
    visit('a2','a','2026-10-02','Student'),
    visit('b2','b','2026-10-02','Staff/Employee'),
    visit('void','a','2026-10-03','Student',{voided_at:'2026-10-04'}),
    visit('outside','a','2026-09-30','Customer'),
  ];
  return data;
}
const scope={start:'2026-10-01',end:'2026-10-03'};
const daily=(data,filter=scope)=>exportTables(data,filter).find(table=>table.name==='Daily attendance');

test('daily export counts each member once per day, retains zero days and uses category at visit',()=>{
  const data=fixture(), before=structuredClone(data), table=daily(data);
  assert.deepEqual(table.headers,['Date','Total attendees','VIP Customer','Customer','Student','Staff/Employee','Guest']);
  assert.deepEqual(table.rows.map(row=>row[0]),[{date:'2026-10-01'},{date:'2026-10-02'},{date:'2026-10-03'}]);
  assert.deepEqual(table.rows.map(row=>row[1].value),[2,2,0]);
  assert.deepEqual(table.rows.map(row=>row.slice(2)),[[0,1,0,1,0],[0,0,1,1,0],[0,0,0,0,0]]);
  for(const [index,row] of table.rows.entries()) {
    assert.equal(row[1].formula,`SUM(C${index+2}:G${index+2})`);
    const matrix=exportTables(data,scope).find(table=>table.name==='Attendance');
    assert.equal(row[1].value,matrix.rows.reduce((sum,member)=>sum+member[index+3],0));
  }
  assert.deepEqual(data,before);
});

test('daily sheet respects the selected category, including historical Staff spelling',()=>{
  assert.deepEqual(daily(fixture(),{...scope,category:'customer'}).rows.map(row=>row[1].value),[1,0,0]);
  assert.deepEqual(daily(fixture(),{...scope,category:'staff'}).rows.map(row=>row[1].value),[1,1,0]);
  assert.deepEqual(daily(fixture(),{...scope,category:'guest'}).rows.map(row=>row[1].value),[0,0,0]);
});

test('unrecorded and legacy categories remain visible without guessing from the current profile',()=>{
  const data=fixture();
  data.attendance=[{id:'unknown',member_id:'a',attendance_date:'2026-10-01',member_category_snapshot:null},
    {id:'legacy',member_id:'b',attendance_date:'2026-10-01',member_category_snapshot:'Former category'}];
  const table=daily(data);
  assert.equal(table.rows[0][table.headers.indexOf('Not recorded')],1);
  assert.equal(table.rows[0][table.headers.indexOf('Former category')],1);
  assert.equal(table.rows[0][table.headers.indexOf('Student')],0);
  assert.equal(table.rows[0][1].value,2);
});

test('daily dates include leap days and cross-year boundaries even with no attendance',()=>{
  const data=createEmptyData();
  assert.deepEqual(daily(data,{start:'2024-02-28',end:'2024-03-01'}).rows.map(row=>row[0].date),['2024-02-28','2024-02-29','2024-03-01']);
  assert.deepEqual(daily(data,{start:'2025-12-31',end:'2026-01-01'}).rows.map(row=>row[1].value),[0,0]);
  assert.equal(daily(data,{start:'2024-01-01',end:'2024-12-31'}).rows.length,366);
  assert.equal(daily(fixture(),{start:'2026-10-02',end:'2026-10-02'}).rows.length,1);
});

test('seventh worksheet retains numeric totals, DMY dates, visible zeroes, filters and frozen date/header',()=>{
  const zip=unzipSync(createPrototypeWorkbook(fixture(),scope));
  const sheet=strFromU8(zip['xl/worksheets/sheet7.xml']);
  assert.match(strFromU8(zip['xl/workbook.xml']),/name="Daily attendance" sheetId="7"/);
  assert.match(sheet,/<c r="A2" s="4"><v>\d+<\/v>/);
  assert.match(sheet,/<c r="B2" s="16"><f>SUM\(C2:G2\)<\/f><v>2<\/v>/);
  assert.match(sheet,/<c r="C2" s="16"><v>0<\/v>/);
  assert.match(sheet,/autoFilter ref="A1:G4"/);
  assert.match(sheet,/xSplit="1" ySplit="1" topLeftCell="B2"/);
  assert.match(strFromU8(zip['xl/styles.xml']),/formatCode="dd\/mm\/yyyy"/);
});
