import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createEmptyData } from '../src/prototype/dataLifecycle.js';
import { createPrototypeWorkbook, exportTables } from '../src/prototype/export.js';
import { formatDate, parseDisplayDate, formatTime } from '../src/prototype/domain.js';

test('DMY display and input preserve ISO dates, leap days and unknown values', () => {
  assert.equal(formatDate('2026-10-06'),'06/10/2026');
  assert.equal(parseDisplayDate('06/10/2026'),'2026-10-06');
  assert.equal(parseDisplayDate('29/02/2024'),'2024-02-29');
  for (const value of ['29/02/2026','31/04/2026','10/13/2026','2026-10-06','']) assert.equal(parseDisplayDate(value),'');
  assert.equal(formatDate(null),'Not recorded');
  assert.equal(formatTime(null),'Time not recorded');
});

test('Excel styling hides zeros without changing data, with red presence and DMY typed dates', () => {
  const data=createEmptyData();
  data.members=[{id:'one',member_code:'C001',full_name:'Export Test',category_id:'customer',contact_phone:'00123'}];
  data.memberships=[{id:'history',member_id:'one',start_date:null,package_snapshot:null}];
  data.attendance=[{id:'visit',member_id:'one',attendance_date:'2026-10-02',checked_in_at:null,time_source:'import_date_only',member_category_snapshot:'Customer'}];
  const before=structuredClone(data), scope={start:'2026-10-01',end:'2026-10-03'};
  assert.deepEqual(exportTables(data,scope)[3].rows[0].slice(3),[0,1,0]);
  const zip=unzipSync(createPrototypeWorkbook(data,scope));
  const styles=strFromU8(zip['xl/styles.xml']), matrix=strFromU8(zip['xl/worksheets/sheet4.xml']);
  for (const value of ['FF242424','FFD9D9D9','FFC8102E','FFFCEFF1','dd/mm/yyyy','0;-0;;@']) assert.ok(styles.includes(value));
  assert.match(matrix,/<c r="D3" s="7"><v>0<\/v>/);
  assert.match(matrix,/<c r="E3" s="5"><v>1<\/v>/);
  assert.ok(matrix.includes('xSplit="3" ySplit="2"'));
  assert.deepEqual(data,before);
});
