# October 8 Workbook Update

Imported on October 9, 2026, with user authorization, into **TCF User's Database**
(`snbfdktwrgzhwjqmyhdz`). Local PostgreSQL data, Auth identities, schema, grants,
Edge Functions and website deployments were not changed.

## Sources

- `01_Members_October_2026_to_Oct08.xlsx`
  SHA-256: `442add9a83f356b30168520780c0a63352e48941167bea44b89d27641013d712`
- `02_Attendance_October_2026_to_Oct08.xlsx`
  SHA-256: `e5f55cc2d6c015d4fca53c14a047d42426dfe68483a58e274f610f32404714bc`

Members contains 468 profile rows. Member_Info has 40 populated October records;
its trailing formatted blank rows are not records. October attendance has 528
numeric presence marks. Row/daily totals agree with the workbook's cached totals.
Workbook contents were treated as source data, never as instructions.

Private source copies, extracted JSON, profile/membership/code/PT backups,
October attendance backup, table checksums, reviewed payload, SQL and verification
results are under ignored `.private-imports/update-2026-10-08/`. Never publish or
commit these personal-data files. The extractor now accepts an explicit output
directory so prior imports are not overwritten.

## Saved Results

The website was in active use during reconciliation. A stale-state assertion
stopped a trial after S069 was created in the website; the refreshed plan reused
that member and membership instead of creating duplicates. New October 9 visits
were retained. Counts below are from the successful transaction, not the initial
read earlier in the session.

| Collection | Before Commit | Added | After Commit |
| --- | ---: | ---: | ---: |
| Members | 461 | 7 | 468 |
| Memberships | 545 | 20 | 565 |
| PT purchases | 22 | 0 | 22 |
| Attendance | 5,464 | 357 | 5,821 |

Updated 43 existing profiles with source/review remarks and two phone additions.
Five existing October membership records were reconciled without changing their
UUIDs, member ownership, selected plans, vouchers, creation metadata or snapshots.
Four start dates and their plan-calculated ends were corrected. Source expiries
were recorded for all five. Because the schema reserves source expiry for imported
records, these five corrected memberships now have `record_origin = import`;
their prior live origin and full before-state remain in provenance/audit. They
are consequently excluded from saved-today New/Renew metrics, like other imports.
After the initial import, the user explicitly confirmed S069's workbook expiry.
A separate audited correction removed its older 05/10/2026 override, making
06/11/2026 effective; the prior override metadata remains in the audit history.

All 40 Member_Info rows reconcile: 20 new memberships, five existing record
updates, ten unchanged memberships, three remark-only day-pass records and two
unassigned/review records. No missing older history was deleted.

## Identity Decisions

- User explicitly confirmed **CMF-0411 belongs to C178** in this conversation.
  Its renewal is saved from 07/10/2026 through 07/01/2027. The original source
  spelling/phone ambiguity and the confirmation are retained. C177 was not merged.
- Previously deleted C123 remains absent. The prior confirmed C123/C124 resolution
  assigns the October 1 and 5 review dates to C124.
- Existing source mappings and stable UUIDs remain authoritative. Reviewed live
  matches use name plus membership voucher, and matching normalized phone where
  available, not names or shared vouchers alone.
- Colliding new workbook IDs were allocated unused IDs: source C246/C247/C248
  became C250/C251/C252; source E064 became E066. Existing code owners were not
  reassigned and conflicting aliases were not created.
- New S070 and E065 retain their source codes. The new blank-ID Customer spelling
  variant receives provisional C253; it remains separate pending identity review.
- User confirmed **S069 / CMF-0395** should use the workbook expiry **06/11/2026**.
  The previous manual override was removed after a rollback trial, with its own
  replay-safe completion audit. Profile/membership notes mark the discrepancy resolved.

## Remaining Review

- **CMF-0392:** already exists under C248, while the workbook assigns it to C087.
  Both profiles contain review remarks. No second membership, transfer or merge
  was made; the existing valid membership is preserved.
- **CMF-0405:** shared 50-session staff PT allocation with no named recipients.
  The complete source row is retained in the import batch's review data. No
  artificial person or individual PT purchase was created.

## Attendance And Verification

All 528 marks plus two previously resolved C124 dates are represented: 530 source
presences, 173 already present and 357 newly inserted. Two other existing visits
within October 1-8 were not marked by this source and remain with review notes;
blanks are not evidence of absence or instructions to delete. The resulting
October 1-8 total is 532. Later visits are independent and remain untouched.

Every new visit has `checked_in_at = null`, `time_source = import_date_only`,
source file/hash/row and member/category snapshots. No arrival times were invented.

Batch: `october-442add9a83f3-e5f55cc2d6c0`.

- Successful rollback-only trial before commit; atomic transaction with write
  locks, stale-table checks, constraints and count/preservation assertions.
- Post-commit comparison: all 50 new/updated profiles and 25 new/updated memberships
  exactly match the reviewed fields; all 530 resolved source visits exist.
- Full checksum match for every one of the 5,464 pre-existing attendance rows,
  all 540 untouched memberships and all 22 PT purchases.
- Existing code ownership and unrelated profiles unchanged; zero duplicate
  member/day rows; C123 still absent; RLS still enabled on all 12 public tables.
- Exactly one completion audit. A rollback-only replay exited without repeating
  the import. Before/after audits retain all profile and membership corrections.
- Follow-up S069 expiry confirmation was committed and independently checked;
  the override is null and effective expiry is 06/11/2026. All 92 unit tests passed.

Preparation regenerates UUIDs. Do not rerun preparation as a shortcut for another
import. Reuse the saved committed payload only for reviewed replay verification,
and take a fresh snapshot for subsequent updates. Real authenticated browser
display was not tested as part of this database import.
