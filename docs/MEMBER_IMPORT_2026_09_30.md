# Member information import — 30 September 2026

Target: **The Community Fitness's Database** (`axbfwmrrxsgzevvqshdu`).
Source: user-supplied `01_Members_Updated.xlsx`, unchanged.
SHA-256: `4c901662331966352abf3b260817c6c93a60dd5fe41b9d906db95a90939a0495`.
Batch: `members-4c90166233196635`.

## Completed and reconciled

| Destination | Records |
|---|---:|
| Members | 424 |
| Membership history | 485 |
| PT purchases | 22 |
| Other historical rows retained in member remarks/provenance | 84 |
| Attendance | 0 — deferred until separate files arrive |
| Current and former member codes | 494 (424 current + 70 aliases) |

Categories: VIP 3, Customer 227, Student 61, Staff/Employee 52, Guest 81.
Packages remain exactly **Gym** and **Swimming Pool Only**. No historical package
definitions were created. Guest category padding was changed to three digits;
no table schema or API grant changes were necessary.

## Mapping decisions

- User confirmed `Recorded Date` is Start Date. A missing value stays unknown.
- Source expiry is preserved as `source_end_date`, including disagreement with
  current calendar rules. Import does not manufacture calculated expiry dates,
  override actors, or historical transaction/save timestamps.
- Missing membership start / plan / expiry: 114 / 168 / 28 rows respectively.
  Missing PT start / expiry: 3 / 6 rows. These are retained history, not rejected
  records. Review notes are on the corresponding member; missing data is not zero.
- Original notes, unsupported class/day-pass/balance history, source ages, ambiguous
  dates and plan discrepancies are retained in member remarks. Source rows are
  also preserved as JSON provenance with sheet, row and source-file hash.
- Blank category profiles are provisionally Guest. Eleven blank IDs were assigned
  new three-digit Guest codes after the largest supplied suffix. Seventy existing
  short Guest codes were normalized and retained as former-code aliases.
- Source IDs are identity anchors. Same-name profiles with different IDs remain
  separate. Six history rows lacking IDs were linked only to their one exact
  workbook profile name; that exceptional link method is recorded for review.
  This does not establish name-based merging for future imports.
- Shared vouchers stay nonunique text on each membership. PT vouchers remain in
  PT remarks/source provenance. No financial fields or payment methods were added.
- PT stays separate; an unconfirmed membership relationship is not invented.
- Day-pass information does not become attendance. Unnamed companions do not
  become invented member profiles. Attendance is still empty.

## Verification and safety

The target was empty before import. A complete rollback-only rehearsal passed;
the actual import committed atomically with an audit batch event. All 591
Member_Info rows (2–592) occur exactly once across membership, PT or remark-only
outcomes. Member, membership and PT field/provenance comparisons against the
prepared source mapping reported **zero mismatches** (424 / 485 / 22 records).
All Guest codes use at least three digits; no code ownership duplicates were
introduced. The Supabase security advisor returned no findings after import.
An idempotent rollback-only replay left the same counts and a single batch audit
event. The original workbook and private backup hashes matched after import.
Read-only batch assertions are in `supabase/tests/member_import_20260930.sql`.

RLS remains enabled on all 12 tables. Anonymous member reads and direct browser /
service-role writes remain closed. No Auth users or staff accounts were created.

The original workbook backup, full review, plan and generated SQL are in ignored
`.private-imports/members-4c90166233196635/`. They contain personal information:
keep them private and do not commit or publish them. The generic preparation
scripts and synthetic mapping tests contain no source people or credentials.
Re-running preparation creates files only; it does not upload anything.

## Local dashboard and remaining integration

The frontend still uses local storage/local login, not this database. It must not
be presented as a live Supabase client. No real source rows were placed in browser
storage, the public directory, or the JS bundle.

New local workspaces start empty with reference catalogues. On the next load,
known fixture people and their dependent records are removed, non-fixture user
records are retained, Guest codes normalized, and the old package list reduced to
the two current packages. Surviving histories keep their package snapshots.
The exact pre-cleanup local payload is recoverable at
`community-fitness:prototype:v1:before-real-members-v1`.
Accounts are untouched. Cleanup fails closed if backup/write fails.

Verification: 39 Node tests, lint and production build passed. An isolated browser
session loaded a 16-person synthetic legacy dataset, confirmed cleanup to zero
people/visits with the raw backup retained, rendered both current packages and
passed the empty-dashboard navigation/runtime-error check. No real user accounts
or browser records were altered by this test session. A synthetic Guest was then
created through the form with ID `G001`, no membership and no attendance; the
isolated browser was closed after verification.

Before live daily use: connect real Auth, enabled staff roles, trusted transactional
write APIs and a Supabase data adapter; test permissions and concurrent operations.
The adapter must support unknown imported dates and must not count bulk-import
timestamps as today's New/Renew sales. Historical attendance comes later; until
then no recorded visit is **unknown history**, not proof of prolonged absence.
