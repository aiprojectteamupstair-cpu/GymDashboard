# November 6 authoritative workbook import — partial, committed

The user replaced the initially supplied files and explicitly authorized a scoped
replacement. Only the corrected `Members_Updated.xlsx` (SHA256
`72f7cd030b6002946907476a223d01176edf8d005d52d48c0dc7dc4730253e18`) and
`Monthly_Attendance_Final.xlsx` (SHA256
`bd2b1e167344d4d300b8d8272e4e4b49c857d9e45315d616aed4215976b8569d`)
were used as business-data sources. All earlier append-only import rules are
superseded for the approved pre-November scope. Old data was used for verified
person/UUID linkage and recovery only.

Project `snbfdktwrgzhwjqmyhdz`; batch
`final-20261106-72f7cd03-bd2b1e16`; committed 06/11/2026 21:20:29 Myanmar time.
Private staging migration `20261106143947_private_final_import_staging` is applied.
The `tcf_import` schema is owner-only, with RLS and no browser/service-role grants.
Auth, operator accounts, catalogues, permissions and deployments were not changed.

| Collection | Inserted | Replaced | Archived |
|---|---:|---:|---:|
| Members | 9 | 474 | 23 |
| Memberships | 175 | 469 | 142 |
| PT purchases | 0 | 22 | 0 |
| Attendance | 333 | 6,805 | 77 |

Verified source profiles: 483 of 520. Database profiles: 521 total, 498 active.
Thirty-seven source identities/code collisions remain held. Thirty-eight verified
UUID mappings retain different readable live IDs; reserved IDs were not stolen.
There are 27 held Member_Info rows: 25 identity holds and two unknown record types.
Do not automatically merge, reassign or approve these holds on a later scan.

| Month | Excel control | Applied source days | Unresolved live days | Current active |
|---|---:|---:|---:|---:|
| July | 1,165 | 1,165 | 0 | 1,165 |
| August | 2,155 | 2,150 | 0 | 2,150 |
| September | 2,125 | 2,124 | 0 | 2,124 |
| October | 1,750 | 1,699 | 17 | 1,716 |
| Total | 7,195 | 7,138 | 17 | 7,155 |

**7,155 is not the completed final control total.** Fifty-seven source visit-days
are held. Seventeen unresolved live October rows remain untouched pending identity
resolution and must not be represented as confirmed final-source records.
Of 210 inferred source days, 209 were applied and one is held. Source evidence and
the inferred flag remain in attendance provenance. Applied July–October rows have
NULL check-in and original check-in times. Prior values are recoverably archived.

Native memberships and PT retain their record type in source provenance. Another
105 Day Pass, legacy class/record, balance and unresolved-type records are stored
as typed, stable-ID objects in `members.source_reference.final_history`, retaining
all original source fields without creating fictional membership entitlements.
The read adapter projects only that history and final source ID, not full import
provenance. Member profiles render this history, and hide voided memberships from
active history. Production frontend deployment remains the user's responsibility.

The private folder `.private-imports/final-2026-11-06-v2/` contains source snapshots,
full table backups, schema metadata, UUID mappings, exact before/after operations,
the transaction and guarded inverse recovery SQL, Burmese report `RESULT_MY.md`,
and identity/attendance/history/code-difference review CSVs. Never commit or serve
these private files. `recoverable-backup-before-commit.zip` has SHA256
`ae01467d7f6e3917b7997f319f521ef762370198d1aff75fee966e6c1113ce6d`.

Verification:

- All 520 unique source IDs, 7,195 monthly source marks and 210 inferred days
  reconcile between Attendance_Data and the four monthly matrices.
- Ten backed-up tables restored into an isolated PostgreSQL schema with exact
  semantic row values, constraints and inter-table FKs verified. The exact import,
  no-op replay and inverse recovery returned to the original before-state; the
  entire local trial was rolled back. Archive file hashes were reread and checked.
- Live table digests and each target's before-state were checked while holding
  the application advisory lock and table write locks immediately before commit.
- All 8,538 staged operations match their committed after-values. Duplicate
  member/date: zero. Attendance, membership and PT orphans: zero.
- Full November-and-later rows match the backup: 30 visits, 31 memberships and
  zero PT purchases. Ownership, timestamps, void state and relationships match.
  The source's 159 November visits and 17 November purchase rows were excluded.
- Live replay added zero missing members, memberships or visits; the single import
  audit remained single. The committed-batch guard does not reapply old data over
  future staff edits or approve pending source rows.
- 119 tests, lint and production build passed. The hosted URL reaches sign-in.
  Authenticated Dashboard rendering remains unverified: Computer Use stopped
  because it could not reliably establish the native browser URL for policy.

Do not claim the import is complete or substitute the current total for 7,195.
Review the private hold files before any follow-up mutation. November remains
protected; never reuse the obsolete first/wrong-file staging folder as a source.
