# October 3 Workbook Update

Imported on October 5, 2026, with user authorization, into **TCF User's Database**
(`snbfdktwrgzhwjqmyhdz`). The local PostgreSQL database remains independent and unchanged.

## Sources

- `01_Members_Updated_to_2026-10-03.xlsx`
  SHA-256: `fbd6b40837d5f668fd332e32b8209086bdfbf1d6f06a741b0f1dfc398c72655d`
- `02_Monthly_Attendance_Jul-Oct_2026_to_Oct03.xlsx`
  SHA-256: `e0945d3d9df950558bf39901a32cf24fe69e94bb300d9f3ab62fd7a4f81bca8f`

Source copies, before-state backups, private reconciliation plans, payload and SQL
are retained under ignored `.private-imports/update-2026-10-03/`. They contain
personal data and must never be committed or published. Workbook contents were
treated as data, not instructions.

## Saved Results

| Collection | Before | Added | After |
| --- | ---: | ---: | ---: |
| Members | 423 | 32 | 455 |
| Memberships | 484 | 55 | 539 |
| PT purchases | 22 | 0 | 22 |
| Attendance | 4,349 | 1,083 | 5,432 |

Updated 52 existing profiles, including source/review remarks, four phone updates
and one explicitly documented Guest-to-Staff/Employee member-category conversion.
One previously unknown membership expiry was supplied by the updated workbook.
Before/after changes were audited. No records were deleted.

All 655 Member_Info rows reconcile: 505 unchanged history rows, one corrected
expiry, 55 new memberships, 93 remark-only records and one previously deleted
duplicate's excluded membership. Shared vouchers never identify or merge people.

## Identity And Review Decisions

- Previously deleted C123 and its membership were not recreated. The already
  confirmed C123/C124 attendance resolution supplies six additional C124 dates.
- G008 became E062 on September 28 with its UUID and former codes retained.
  Historical snapshots are unchanged; new visits use the category at that date.
- Source G72-G75 collide with existing code ownership. Their new people receive
  G084-G087; conflicting aliases were not created. Existing owners retain history.
- Blank-ID profiles with exact original source identity fields retain their
  existing UUIDs. Unconfirmed spelling variants remain separate provisional
  profiles with explanatory remarks, never automatic name-based merges.
- Unknown categories remain provisional Guest and are identified in remarks.
- Fourteen ambiguous July dates involving two possible profiles were not newly
  assigned. Existing visits were preserved and review notes attached.
- An uncertain August 4 mark is retained in remarks, not treated as attendance.

## Attendance Reconciliation

Recalculated row, daily and monthly totals match the workbook's cached totals.
There are 5,386 numeric presence marks plus 32 previously resolved review dates:
5,418 resolved source presences, of which 4,335 already existed. Added 916 September
and 167 October visits. Fourteen old visits not reconfirmed by this source remain.
Blanks are not evidence of absence and never delete prior attendance.

All new visits have `checked_in_at = null` and `time_source = import_date_only`.
No arrival time was invented. Final monthly totals are July 1,139; August 2,064;
September 2,062; October 167. The source ends October 3, not the import date.

## Verification And Replay

The import used a single transaction, write locks, stale-row assertions, count
assertions and audited batch identity `update-fbd6b40837d5-e0945d3d9df9`.
The full rollback-only dry run passed before commit. Post-commit checks verified:

- All 84 new/updated profiles, 55 new memberships and 1,083 new visits match payload.
- All 4,349 old visits, 483 unchanged memberships and 22 PT purchases are intact.
- The corrected expiry matches source; all 455 current member codes are unique.
- Zero duplicate active member/day presences; C123 is still absent.
- Exactly one completion audit; replaying the same SQL in a rollback transaction
  exits without another import.
- `npm test`: 86 passed. `npm run lint`: passed.

Preparation scripts generate new UUIDs: do not rerun them as an import shortcut.
Retain the committed payload and review a fresh snapshot for subsequent updates.
No schema, grants, Auth identities, passwords or deployments changed. Authenticated
browser display was not tested as part of this database import.
