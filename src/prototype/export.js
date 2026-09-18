import { strToU8, zipSync } from 'fflate';
import { categoryLabel, endDate, formatTime, localDate } from './domain.js';

const xml = value => Array.from(String(value ?? '')).filter(char => char.codePointAt(0) >= 32 || ['\t', '\n', '\r'].includes(char)).join('').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const column = index => { let result = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result; };
const date = value => value ? { date: value } : '';

function cell(value, row, col, style = 0) {
  const ref = `${column(col)}${row}`;
  if (value && typeof value === 'object' && value.date) {
    const serial = (Date.parse(`${value.date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
    return `<c r="${ref}" s="3"><v>${serial}</v></c>`;
  }
  if (typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

export function exportTables(data, { start = '', end = '' } = {}) {
  const filtered = Boolean(start && end);
  const attendance = data.attendance.filter(a => !a.voided_at && (!filtered || (a.attendance_date >= start && a.attendance_date <= end))).sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at));
  const ids = new Set(attendance.map(a => a.member_id));
  const members = data.members.filter(m => !filtered || ids.has(m.id));
  const memberships = data.memberships.filter(m => !filtered || ids.has(m.member_id));
  const memberMap = new Map(members.map(m => [m.id, m]));
  const scope = filtered ? `Attendance: ${start} to ${end} (Myanmar). All membership history for those attendees included.` : 'All prototype members and history, including archived profiles.';
  return [
    { name: 'Read me', headers: ['Item', 'Details'], rows: [
      ['The Community Fitness', 'UI prototype export — fictional sample data'], ['Scope', scope],
      ['Exported on', localDate()], ['Timezone', 'Asia/Rangoon'], ['Members', members.length], ['Memberships', memberships.length], ['Attendance', attendance.length],
      ['Date rule', 'Calendar-based dates. Effective end = manual override when present; otherwise calculated end.'],
      ['Entry policy', 'Expiry-day eligibility is pending. This export does not establish entry eligibility.'],
      ['Payment methods', 'Prototype examples. No monetary values are stored.'],
    ] },
    { name: 'Members', headers: ['Member code', 'Full name', 'Category', 'Phone', 'Date of birth', 'Student ID', 'Archived on', 'Remark'], rows: members.map(m => [m.member_code, m.full_name, categoryLabel(data, m), m.contact_phone, date(m.date_of_birth), m.student_id, date(m.archived_at ? localDate(m.archived_at) : ''), m.remark]) },
    { name: 'Memberships', headers: ['Membership ID', 'Member code', 'Member name', 'Package', 'Category at purchase', 'Start date', 'Calculated end', 'Manual end', 'Effective end', 'Override reason', 'Payment method', 'Voucher reference', 'Access', 'Remark'], rows: memberships.map(m => [m.id, memberMap.get(m.member_id)?.member_code, memberMap.get(m.member_id)?.full_name, m.package_snapshot.label, m.member_category_snapshot, date(m.start_date), date(m.calculated_end_date), date(m.override_end_date), date(endDate(m)), m.override_reason, m.payment_method_label_snapshot || 'Not recorded', m.voucher_reference, m.package_snapshot.access_notes, m.remark]) },
    { name: 'Attendance', headers: ['Member code', 'Member name', 'Myanmar date', 'Myanmar check-in time', 'Category at visit', 'Membership ID', 'Recorded by'], rows: attendance.map(a => [memberMap.get(a.member_id)?.member_code, memberMap.get(a.member_id)?.full_name, date(a.attendance_date), formatTime(a.checked_in_at), a.member_category_snapshot, a.membership_id || '', data.app_staff.find(s => s.user_id === a.checked_in_by)?.display_name || 'Not recorded']) },
  ];
}

export function createPrototypeWorkbook(data, scope) {
  const tables = exportTables(data, scope);
  const files = {};
  const add = (path, value) => { files[path] = strToU8(value); };
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables.map((t, i) => `<sheet name="${xml(t.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/><color rgb="FF303247"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF303247"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F5F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  tables.forEach((table, i) => {
    const rows = [`<row r="1" ht="32" customHeight="1">${table.headers.map((v, c) => cell(v, 1, c, 1)).join('')}</row>`, ...table.rows.map((row, r) => `<row r="${r + 2}" ht="24" customHeight="1">${row.map((v, c) => cell(v, r + 2, c, r % 2 ? 2 : 0)).join('')}</row>`)];
    add(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${table.headers.map((h, c) => `<col min="${c + 1}" max="${c + 1}" width="${table.name === 'Read me' && c === 1 ? 100 : /Remark|reason|Access/.test(h) ? 46 : /name|Package|ID/.test(h) ? 30 : 23}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:${column(table.headers.length - 1)}${table.rows.length + 1}"/></worksheet>`);
  });
  return zipSync(files, { level: 6 });
}

export function downloadPrototypeWorkbook(data, scope) {
  const bytes = createPrototypeWorkbook(data, scope);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url; link.download = `community-fitness-prototype-${scope?.start || 'all'}-${scope?.end || localDate()}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
