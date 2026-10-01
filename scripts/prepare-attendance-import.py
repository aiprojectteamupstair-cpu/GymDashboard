"""Read approved workbook; emit private, reviewable import payload (never modifies XLSX)."""
import calendar, collections, hashlib, json, pathlib, re, sys
import openpyxl

source = pathlib.Path(sys.argv[1])
digest = hashlib.sha256(source.read_bytes()).hexdigest()
directory = pathlib.Path('.private-imports') / ('attendance-' + digest[:16])
directory.mkdir(exist_ok=True)
known = json.loads(pathlib.Path('.private-imports/attendance-live-members.json').read_text())
codes = {m['code']: m for m in known}
master = json.loads(pathlib.Path('.private-imports/members-4c90166233196635/plan.json').read_text(encoding='utf-8'))
source_rows = {m['source_reference']['row']: m for m in master['members']}
normal = lambda value: re.sub(r'\s+', ' ', str(value or '').strip()).casefold()
w = openpyxl.load_workbook(source, read_only=True, data_only=True)
records, issues, summaries, notes, seen = [], [], [], [], set()
for sheet in w:
    month = {'July': 7, 'August': 8, 'September': 9}[sheet.title]
    rows = list(sheet.values)
    header = next(i for i, row in enumerate(rows) if row and row[0] == 'Member ID')
    day_count = calendar.monthrange(2026, month)[1]
    assert [str(x) for x in rows[header][4:4 + day_count]] == [str(x) for x in range(1, day_count + 1)]
    visits, members, member_rows = 0, 0, 0
    for index, row in enumerate(rows[header + 1:], header + 2):
        if index > header + 1 + 424:
            if any(x is not None for x in row): notes.append({'sheet': sheet.title, 'row': index, 'values': [x for x in row if x is not None]})
            continue
        member_rows += 1
        code, name, category, total = row[:4]
        original = source_rows[index - 6]
        assert normal(original['full_name']) == normal(name), 'Source row identity mismatch'
        expected_code = original['source_reference']['original']['Member ID']
        canonical = lambda c: ('G' + str(int(c[1:])).zfill(3)) if c and str(c).startswith('G') else c or None
        if code: assert canonical(code) == canonical(expected_code), ('Source code mismatch', index, code, expected_code)
        if code == 'C123':
            assert not any(v == 1 for v in row[4:4 + day_count]), 'Deleted C123 has marked attendance; review before import'
            continue
        code = str(code or original['member_code']).strip()
        person = codes.get(code)
        if person is None or normal(person['full_name']) != normal(name):
            issues.append({'sheet': sheet.title, 'row': index, 'code': code, 'name': name, 'reason': 'ID/name mismatch'})
            continue
        values = row[4:4 + day_count]
        assert all(v in (None, '', 0, 1) for v in values), (sheet.title, index, 'Unexpected attendance value')
        days = [i + 1 for i, v in enumerate(values) if v == 1]
        assert int(total or 0) == len(days), (sheet.title, index, 'Total mismatch')
        for day in days:
            key = (person['member_id'], f'2026-{month:02}-{day:02}')
            assert key not in seen, ('Duplicate member/day', key)
            seen.add(key)
        if days:
            records.append({'code': code, 'member_id': person['member_id'], 'category': category or 'Guest', 'sheet': sheet.title, 'row': index, 'month': month, 'days': days})
            visits += len(days); members += 1
    summaries.append({'sheet': sheet.title, 'member_rows': member_rows, 'members_with_visits': members, 'visits': visits})
    total_row = next(r for r in rows if len(r)>1 and r[1] == 'Daily total')
    assert total_row[3] == visits, 'Sheet total mismatch'
    note = next((i, r[1]) for i,r in enumerate(rows,1) if len(r)>1 and str(r[1]).startswith('Unassigned Min Ko Ko dates'))
    days = [int(d.strip()) for d in note[1].split(':',1)[1].rstrip('.').split(',')]
    person = codes['C124']
    unique_days = [d for d in days if (person['member_id'], f'2026-{month:02}-{d:02}') not in seen]
    for d in unique_days: seen.add((person['member_id'],f'2026-{month:02}-{d:02}'))
    records.append({'code':'C124','member_id':person['member_id'],'category':'Customer','sheet':sheet.title,'row':note[0],'month':month,'days':unique_days,'resolved_note':True})
    summaries[-1]['resolved_extra_visits'] = len(unique_days)
dates = sorted(date for _, date in seen)
report = {'file': source.name, 'sha256': digest, 'batch': directory.name, 'sheets': summaries, 'total': len(seen), 'first_date': dates[0], 'last_date': dates[-1], 'issues': issues, 'notes': notes}
(directory / 'plan.json').write_text(json.dumps({'report': report, 'records': records}, ensure_ascii=False, indent=2), encoding='utf-8')
(directory / 'source.xlsx').write_bytes(source.read_bytes())
print(json.dumps({k: v for k, v in report.items() if k != 'notes'}, ensure_ascii=True))
print(json.dumps({'source_notes': notes}, ensure_ascii=True))
