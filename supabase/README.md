# Supabase schema foundation

## October 1 connection work

Update: approved confirmed Auth account is now linked to the enabled Super Admin
staff profile, with an audit event. Positive/negative database RLS role tests
passed (424/485/22 for owner; zero members for disabled/unregistered identities).
Local Auth HTTPS timeout still blocks end-to-end browser login verification.
Security advisor reports disabled leaked-password protection; see the connection
document for its remediation link. Earlier pending-profile notes below are historical.

The webpage now has a Supabase Auth/read-only adapter. Auth HTTPS requests from
this machine time out, so no owner Auth account or verification email is confirmed.
A disabled/unlinked Super Admin staff profile was prepared; it grants no access.
No table grants/RLS or member records changed. See
[connection status and remaining setup](../docs/SUPABASE_WEB_CONNECTION.md).

## September 30 member information import

The approved workbook is now committed: **424 members, 485 memberships, 22 PT
purchases**; 84 additional historical rows are retained in member remarks and
source provenance. All 591 info rows reconciled, field comparisons have zero
mismatches, security advisor has no findings. Attendance remains **0**. Guest
padding is three digits with former aliases preserved; packages remain Gym and
Swimming Pool Only. No Auth bootstrap, schema changes or write grants were added.
The frontend is still local-only. See [full import decisions and checks](../docs/MEMBER_IMPORT_2026_09_30.md).

## September 30 frontend adjustments

Live read-only inspection confirmed payment columns are nullable and vouchers are text with no uniqueness requirement. No schema migration, account bootstrap or grant change was necessary. Payment methods are retired in current UI/new local records/exports; existing historical fields and optional database columns remain untouched. Voucher references remain per membership, may be shared across people and are exported as text. Attendance circles and grouped month/date Excel headers are derived presentation changes. Frontend Auth/CRUD integration remains pending; no new live writes were opened.

Applied 2026-09-29 using the selected Supabase plugin.

- Project: **The Community Fitness's Database**
- Project ref: `axbfwmrrxsgzevvqshdu` (Tokyo / ap-northeast-1)
- Remote migration: `20260929094219_community_fitness_foundation`
- Checked before applying: public schema had no tables.
- Local migration filename matches the remote migration ledger.

## Scope

The eleven local collections now have public tables. `member_codes` is an
additional normalized reservation table for current/former readable member IDs.
Local `previous_codes` arrays will be mapped to this table by the future adapter.
Business entities have UUIDs. Reference catalogue IDs remain text, matching the
current application (`gym`, `plan-1`, etc.); new catalogue IDs default to UUID text.
`app_staff.id` is a stable operator identity; nullable `user_id` references Auth.
Actor references use the stable operator id, not a local account id/password hash.

The initial foundation seeded only 5 categories, 2 packages, 4 plans and 3
discounts. The subsequent approved member import is described above. Payment
methods remain empty/unused. No visits, operator profiles, Auth users or local
browser accounts have been uploaded.

## Access boundary

All 12 tables have RLS enabled. Anonymous access is revoked. Authenticated
operators can SELECT only if an enabled, non-deleted `app_staff` profile matches
`auth.uid()`. Staff can read only their own operator profile at this stage.
There is no use of user-editable JWT metadata for authorization.

INSERT/UPDATE/DELETE are NOT granted to browser roles. Service-role table grants
were also explicitly revoked for this initial closed-write stage. Owner-level
migrations/SQL Editor remain able to administer the schema. No broad project
defaults, Auth configuration, other schemas or API keys were changed.

This is a schema foundation, NOT an enabled online application. The React app
still uses local storage and local login. Do not point it at these tables with
a privileged key or copy local password hashes into Supabase.

## Integrity and import preparation

- One attendance row per member/Myanmar day, including voided reservations.
- Cross-member membership links on attendance/PT are rejected by composite FKs.
- Current member code must belong to the same UUID in `member_codes`; create both
  rows in one transaction. Alias reassignment/deletion and concurrency-safe code
  allocation still need a trusted API before production writes open.
- Live calendar ends are checked against a single calendar-month addition;
  overrides require reason, actor and timestamp. No expiry-day eligibility rule
  is silently finalized.
- Catalogue edits do not change stored JSON snapshots.
- Import rows support source provenance, original source expiry and unknown dates.
  Date-only historical attendance allows a null time instead of invented midnight.
  Imported data needs a reviewed mapping/staging workflow before any upload.
- Archive/history references use restrictive deletes, not member-history cascades.
- Live check-in time must match its attendance day and not exceed record/update
  timestamps. These timestamps must be server-controlled in the future write API.

## Verified on the actual database

`tests/foundation.sql` and `tests/access.sql` run inside transactions and roll back.
Both passed. Tested duplicate code/day rejection, code ownership, cross-member FK,
month/leap-year ends, missing override metadata, PT duration, immutable snapshot
behavior under catalogue rename, source expiry/date-only import preservation,
restrictive history deletes, unaffiliated/anonymous denial and rejected writes
and role self-promotion. Test rows and temporary catalogue edits did not persist.

Security advisor: no findings after migration. Performance advisor: unused-index
INFO findings expected on an empty database; retain FK/report indexes until there
is a real workload to measure. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Positive enabled-staff access tests, disabled/deleted role lifecycle tests,
concurrent allocation/check-in retries and end-to-end Auth/CRUD are still required
when the application write APIs are implemented. Current tests do not claim those.

## Next stage

1. Choose the initial Super Admin Auth email and login approach. No default account.
2. Build transactional trusted writes: member/code allocation and Guest conversion,
   membership/PT snapshots, check-in/retries/time correction, audit events, catalogue
   role checks and account management. Generate timestamps/actors server-side.
3. Grant only the reviewed API operations. Wire a separate Supabase adapter and
   publishable-key client, keeping local records separate (no silent bulk upload).
4. Verify allow/deny and concurrency flows before production use.
5. Review the imported unknown dates/plans as details become available. Import
   attendance only from the separate files the user will provide, using source
   reconciliation and existing member-code ownership.

The credential previously pasted into chat was not used or saved. Rotate it in
Supabase if not already done. No password or privileged key belongs in this repo.
