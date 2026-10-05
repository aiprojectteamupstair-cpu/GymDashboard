"""Read-only XLSX extraction; private JSON and unchanged source backups only."""
import datetime
import hashlib
import json
import pathlib
import shutil
import sys
import openpyxl

destination = pathlib.Path('.private-imports/update-2026-10-03')
destination.mkdir(parents=True, exist_ok=True)
report = []
for index, argument in enumerate(sys.argv[1:]):
    source = pathlib.Path(argument)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    formulas = openpyxl.load_workbook(source, read_only=True, data_only=False)
    formula_cells = [(sheet.title, cell.coordinate) for sheet in formulas for row in sheet for cell in row if cell.data_type == 'f']
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
    sheets = {sheet.title: list(sheet.values) for sheet in workbook}
    payload = {'file': source.name, 'sha256': digest, 'sheets': sheets, 'formula_cells': formula_cells}
    target = destination / ('members-source.json' if index == 0 else 'attendance-source.json')
    target.write_text(json.dumps(payload, ensure_ascii=False, default=lambda value: value.isoformat() if isinstance(value, (datetime.datetime, datetime.date)) else str(value)), encoding='utf-8')
    backup = destination / source.name
    if backup.exists():
        assert hashlib.sha256(backup.read_bytes()).hexdigest() == digest, 'Existing backup differs'
    else:
        shutil.copy2(source, backup)
    report.append({'file': source.name, 'sha256': digest, 'sheets': {name: len(rows) for name, rows in sheets.items()}, 'formulas': len(formula_cells)})
print(json.dumps(report))
