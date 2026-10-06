import { strToU8, zipSync } from 'fflate';
import { ageOn, categoryLabel, endDate, formatDate, localDate, membershipStatus, shiftDays, validDate } from './domain.js';

const xml = value => Array.from(String(value ?? '')).filter(char => char.codePointAt(0) >= 32 || ['\t', '\n', '\r'].includes(char)).join('').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const column = index => { let result = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };
const date = value => value ? { date: value } : '';

function cell(value, row, col, style = 0) {
  const ref = `${column(col)}${row}`;
  if (value && typeof value === 'object' && value.date) {
    const serial = (Date.parse(`${value.date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
    return `<c r="${ref}" s="${style === 2 ? 4 : 3}"><v>${serial}</v></c>`;
  }
  if (typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${style === 0 ? 9 : style === 2 ? 10 : style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

export function exportTables(data, { start = '', end = '', category = 'all' } = {}) {
  const filtered = Boolean(start && end);
  const selectedLabel = data.member_categories.find(c => c.id === category)?.label;
  const seen = new Set();
  const attendance = data.attendance.filter(a => !a.voided_at && (category === 'all' || (category === 'staff' ? ['Staff', 'Staff/Employee'].includes(a.member_category_snapshot) : a.member_category_snapshot === selectedLabel)) && (!filtered || (a.attendance_date >= start && a.attendance_date <= end))).sort((a, b) => (a.checked_in_at || a.attendance_date).localeCompare(b.checked_in_at || b.attendance_date)).filter(a => {
    const key = `${a.member_id}/${a.attendance_date}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const ids = new Set(attendance.map(a => a.member_id));
  const members = data.members.filter(m => category === 'all' || m.category_id === category || ids.has(m.id));
  const memberIds = new Set(members.map(m=>m.id));
  const memberships = data.memberships.filter(m => !m.voided_at && (memberIds.has(m.member_id)));
  const training = (data.training_purchases || []).filter(t => !t.voided_at && (memberIds.has(t.member_id)));
  const memberMap = new Map(members.map(m => [m.id, m]));
  const scope = filtered ? `Attendance: ${formatDate(start)} to ${formatDate(end)} (Myanmar). Includes selected members with no recorded visits and their history.` : 'All members and history, including archived profiles.';
  const today = localDate();
  const dates = attendance.map(a=>a.attendance_date).sort();
  const rangeStart = filtered ? start : dates[0] || today;
  const rangeEnd = filtered ? end : dates.at(-1) || today;
  const days = Math.round((Date.parse(rangeEnd)-Date.parse(rangeStart))/86400000)+1;
  if (!validDate(rangeStart) || !validDate(rangeEnd) || days<1 || days>366) throw new Error('Choose an export period of 1–366 days.');
  const columns = Array.from({length:days},(_,i)=>shiftDays(rangeStart,i));
  const present = new Set(attendance.map(a=>`${a.member_id}/${a.attendance_date}`));
  return [
    { name: 'Read me', headers: ['Report', 'Details'], rows: [
      ['The Community Fitness', 'Member and attendance report'], ['Scope', scope], ['Attendance category', category === 'all' ? 'All categories' : selectedLabel || category], ['Exported on', date(today)],
      ['Timezone', 'Myanmar (Asia/Rangoon)'], ['Members', members.length], ['Memberships', memberships.length], ['Attendance', attendance.length], ['PT purchases', training.length],
      ['Notes', 'Attendance: 1 = recorded presence. Blank = no matching check-in record, not proof of absence. Zero values are retained for calculations but displayed as blank. Includes selected members even with no visits. Current category or matching historical visits determine the selected population.'],
      ['Dates and status', 'End dates include admin overrides. Status and age are as of export date. Attendance columns cover every day of the selected period.'],
      ['Staff calendar', 'Staff profile cycles include the 25th at both ends. Attendance sheet lists each actual visit once.'],
      ['Voucher No.', 'Memberships lists each saved membership voucher. A voucher may cover multiple people and is not a unique member ID. Blank means not recorded.'],
    ] },
    { name: 'Members', headers: ['Member ID', 'Name', 'Category', 'Phone', 'Age', 'Student ID', 'Profile status', 'Remark'],
      rows: members.map(m => [m.member_code, m.full_name, categoryLabel(data, m), m.contact_phone, ageOn(m.date_of_birth, today) ?? '', m.student_id, m.archived_at ? 'Archived' : 'Current', m.remark]) },
    { name: 'Memberships', headers: ['Member ID', 'Name', 'Package', 'Plan', 'Discount', 'Start date', 'End date', 'Status', 'Voucher No.', 'Remark'],
      rows: memberships.map(m => [memberMap.get(m.member_id)?.member_code, memberMap.get(m.member_id)?.full_name, m.package_snapshot?.label || 'Not recorded', m.plan_snapshot?.label || 'Not recorded', m.discount_snapshot?.label || (m.plan_snapshot ? 'None' : 'Not recorded'), date(m.start_date), date(endDate(m)), membershipStatus(m, today), m.voucher_reference || '', m.remark]) },
    { name: 'Attendance', headers: ['Member ID', 'Name', 'Category', ...columns],
      rows: members.map(m => [m.member_code, m.full_name, categoryLabel(data,m), ...columns.map(day=>present.has(`${m.id}/${day}`) ? 1 : 0)]) },
    { name: 'Training', headers: ['Member ID', 'Name', 'PT sessions', 'Start date', 'End date', 'Status'],
      rows: training.map(t => [memberMap.get(t.member_id)?.member_code, memberMap.get(t.member_id)?.full_name, t.sessions, date(t.start_date), date(t.end_date), membershipStatus({ start_date: t.start_date, calculated_end_date: t.end_date }, today)]) },
  ];
}

function workbookStyles() {
  const font = (color, bold = false) => `<font>${bold ? '<b/>' : ''}<sz val="11"/><name val="Arial"/><color rgb="${color}"/></font>`;
  const fill = color => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`;
  const style = (fontId, fillId, numFmtId = 0, centered = false) => `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"${centered ? ' horizontal="center"' : ''} wrapText="1"/></xf>`;
  return `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0;-0;;@"/></numFmts>
    <fonts count="3">${font('FF222222')}${font('FFFFFFFF',true)}${font('FFC8102E',true)}</fonts>
    <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('FF242424')}${fill('FFD9D9D9')}${fill('FFFCEFF1')}</fills>
    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="11">${style(0,0)}${style(1,2,0,true)}${style(0,3)}${style(0,0,164,true)}${style(0,3,164,true)}${style(2,4,165,true)}${style(0,0,165,true)}${style(0,3,165,true)}${style(1,2,1,true)}${style(0,0,49)}${style(0,3,49)}</cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

export function createPrototypeWorkbook(data, scope) {
  const tables = exportTables(data, scope);
  const files = {};
  const add = (path, value) => { files[path] = strToU8(value); };
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((t, i) => `<sheet name="${xml(t.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', workbookStyles());
  tables.forEach((table, i) => {
    const matrix = table.name === 'Attendance';
    const headerRow = matrix ? 2 : 1;
    const merges = [];
    const monthCells = [];
    if (matrix) {
      monthCells.push(cell('Member details', 1, 0, 1));
      merges.push('A1:C1');
      for (let c = 3; c < table.headers.length;) {
        const month = table.headers[c].slice(0, 7);
        let last = c;
        while (last + 1 < table.headers.length && table.headers[last + 1].startsWith(month)) last++;
        const label = new Intl.DateTimeFormat('en-GB', { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(month + '-01T00:00:00Z'));
        monthCells.push(cell(label, 1, c, 1));
        if (last > c) merges.push(column(c) + '1:' + column(last) + '1');
        c = last + 1;
      }
    }
    const rows = [
      ...(matrix ? ['<row r="1" ht="30" customHeight="1">' + monthCells.join('') + '</row>'] : []),
      '<row r="' + headerRow + '" ht="32" customHeight="1">' + table.headers.map((v,c)=>cell(matrix && c >= 3 ? Number(v.slice(8)) : v,headerRow,c,matrix && c >= 3 ? 8 : 1)).join('') + '</row>',
      ...table.rows.map((row,r)=>'<row r="' + (r + headerRow + 1) + '" ht="' + Math.max(28,...row.map(v=>Math.ceil(String(typeof v === 'object' ? '' : v ?? '').length/(table.name==='Read me'?90:38))*17)) + '" customHeight="1">' + row.map((v,c)=>cell(v,r+headerRow+1,c,matrix && c>=3 ? v===1 ? 5 : r%2 ? 6 : 7 : r%2 ? 0 : 2)).join('') + '</row>')
    ];
    const pane = matrix ? 'xSplit="3" ySplit="2" topLeftCell="D3" activePane="bottomRight"' : 'ySplit="1" topLeftCell="A2" activePane="bottomLeft"';
    const cols = table.headers.map((h,c)=>'<col min="' + (c+1) + '" max="' + (c+1) + '" width="' + (matrix && c>=3 ? 6 : table.name==='Read me' ? c===1 ? 100 : 30 : h==='Remark' ? 42 : h==='Name' ? 26 : h==='Package' ? 24 : /Category|Discount/.test(h) ? 22 : 18) + '" customWidth="1"/>').join('');
    add('xl/worksheets/sheet' + (i+1) + '.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ' + pane + ' state="frozen"/></sheetView></sheetViews><cols>' + cols + '</cols><sheetData>' + rows.join('') + '</sheetData><autoFilter ref="A' + headerRow + ':' + column(table.headers.length-1) + (table.rows.length+headerRow) + '"/>' + (merges.length ? '<mergeCells count="' + merges.length + '">' + merges.map(ref=>'<mergeCell ref="' + ref + '"/>').join('') + '</mergeCells>' : '') + '</worksheet>');
  });
  return zipSync(files, { level: 6 });
}

export function downloadPrototypeWorkbook(data, scope) {
  const bytes = createPrototypeWorkbook(data, scope);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url; link.download = `community-fitness-${scope?.start || 'all'}-${scope?.end || localDate()}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
