# Attendance import — 1 October 2026

Approved workbook: `02_Monthly_Attendance_Jul_Aug_Sep_2026.xlsx`.
SHA-256: `d03863e9518348ef1f5ad0ea061cefffa6a465b9b697ba6bec8bc735eac9c114`.
Batch: `attendance-d03863e9518348ef`.

| Month | Imported daily presences |
| --- | ---: |
| July | 1,139 |
| August | 2,064 |
| September | 1,146 |
| Total | 4,349 |

Observed dates: July 1–September 16, 2026. Source 1 values only; blanks and zeroes do not create records. Trailing September blanks are not confirmed absences. Latest member-information source date is September 21, not a guarantee of complete coverage.

The user explicitly authorized deletion of duplicate C123 and all its history: one member and one membership were removed, with a private pre-deletion backup. No PT or attendance existed for C123. C124 remains; 26 ambiguous note dates were resolved to C124, without merging membership history. One unconfirmed August 4 source mark remains excluded.

Missing IDs were matched through the preceding import's source-row identity mapping plus exact normalized names, not names alone. Former Guest codes retain their aliases. Workbook/source-row/date provenance is retained. Historical membership linkage remains null where uncertain.

The user permitted placeholder times: 18:00 Myanmar is explicitly `import_assumed`, not an observed arrival. UI labels it assumed; arrival-hour analysis excludes it. Daily attendance and Excel presence counts include it.

Rollback dry-run and committed reconciliation passed: 4,349 expected records, zero duplicate member/day entries. Current database totals: 423 members, 484 memberships, 22 PT purchases, 4,349 attendance. Owner RLS can read attendance; unaffiliated/browser writes remain closed.

Private workbook, plan, SQL and deletion backup remain in ignored `.private-imports/`. Do not publish them. Preparation scripts are `scripts/prepare-attendance-import.py` and `scripts/build-attendance-sql.mjs`.

Next requested sources: attendance September 17 onward and member-information updates September 22 onward, plus corrections to earlier periods. Import must remain idempotent and preserve source provenance.
