# Dashboard implementation

> September 30 member release: [real member information is imported in Supabase](MEMBER_IMPORT_2026_09_30.md), but frontend/Auth integration remains pending. The local app no longer seeds fictional people. Existing known fixtures are retired on load with an exact raw backup; user-created records/history survive. Guest codes use G001…; old catalogue rows are removed from the current list, leaving Gym and Swimming Pool Only. Source member information is not embedded in the client.

> September 30: payment collection/display/export removed without deleting history. Dashboard attendance circles replace the standalone Active card; Yellow/Red are active members with a last recorded visit 10–20/>20 days ago, with no-history members separate. Excel groups attendance dates under month/year headers and exports nonunique Voucher No. in Memberships. Admin minimum password is six characters. Fixed owner credentials are not embedded; safe setup choice is pending. Frontend remains local; backend schema did not need changes.

> September 29: the Supabase database foundation is created and tested; the running webpage still uses the existing local repository and login. Schema deployment does not connect the frontend. [Live schema status, access boundary and next steps](../supabase/README.md).

Updated: 2026-09-23. Product UI follows the revised category/package concept.
Development-status labels were removed as requested. The application still uses
local browser storage; Supabase/Auth are not connected to this UI.

## Implemented

- Five member categories with VC/C/S/E/G readable IDs and stable internal identity.
- Profile creation/edit, former-ID search, archive/restore and attendance calendars.
- Guest first-day trial, repeated same-day lookup and atomic conversion with membership.
- Separate package, 1/3/6/12-month plan and optional discount dropdowns.
- Gym PT purchase records, 5/10/20/50 sessions, validity from membership start.
- Manual start, calendar end, explicit admin override and renewal history.
- Packages & Discounts: create, active/inactive (no detail edits), filtered selections and history snapshots.
- Dashboard/analytics and five-sheet Excel export including Training.
- Modal background interaction/scroll lock and independent form scrolling.

## Code and local data

Entry: `src/main.jsx` -> `src/prototype/PrototypeApp.jsx`.
`repository.js` owns local transactions. `membershipService.js` validates and
builds membership/training records; `catalogue.js` defines confirmed catalogues,
category code allocation and local schema upgrade. `domain.js` handles dates,
search and attendance. Pages/forms call repository operations.

There are eleven collections: the original eight plus `membership_plans`,
`discounts` and `training_purchases`. The separate Supabase database has the
foundation and approved import described above.

The local storage key stays `community-fitness:prototype:v1`; the payload has
`schema_version: 2`. On read, the old shape is upgraded in memory. The first write
backs up raw pre-versioned data at `community-fitness:prototype:v1:before-concept-v2`.
Legacy histories/expiry dates stay unchanged and unknown categories remain
unresolved. The subsequent member-release cleanup removes known fixture people
and old catalogue rows, preserving user-created history/snapshots. Existing
readable codes become aliases when known categories receive new prefixes or
Guest padding. User-created people are never merged by name.

Fixtures are fictional and now used only by tests, never by the default repository.
`dataLifecycle.js` implements the empty initial data and one-time fixture retirement.
The raw payload is backed up at `community-fitness:prototype:v1:before-real-members-v1`.
Source workbook PII is not included. Payment options are unused.
The original app and its separate storage are retained.

## Current limits

No real database/server-backed authentication, shared-device synchronization or server-side concurrency. Local login is described below.
UI labels do not establish authorization. Guest first-check-in trial behavior is
implemented; trial reissue, membership expiry-day eligibility, overlap policy,
required fields and final server-side permission enforcement remain pending. PT purchases are
recorded; per-session use is not implemented. Same-day time corrections are implemented (see September 23).

## Verification

Thirty-nine Node tests cover calendar/leap years, Myanmar midnight, category code
allocation, former IDs, atomic Guest conversion, trial-day limits, active
catalogues, historical snapshots, PT validity, failed/corrupt storage,
legacy upgrade, fixture retirement/backup failures, import mapping and export reconciliation.

Browser verification covers catalogue creation/status, active-only dropdowns,
member creation with plan/discount/PT, renewal and override, pool clearing PT,
Guest check-in/conversion/history, reload/former-ID search, Excel download,
mobile forms/catalogue and background scroll isolation. Lint and build are
required application checks.

Next: review the current screens, settle the pending business rules and select
the Supabase project. Then implement trusted database writes, Auth/RLS and
reviewed Excel import mappings. [Brief](PROJECT_BRIEF.md), [Screens](SCREEN_FLOW.md),
[Data model](DATA_MODEL.md).

## September 21 verified refinements

- Light/dark token-based UI, larger text, simplified forms and persistent preference.
- Dashboard summary drilldowns; New member only in the member directory.
- Separate Analytics: period/category filters, previous-period daily comparison, visits/unique/repeat metrics, weekday averages, arrival hours and follow-up list.
- All categories, including Staff/Employee, use normal calendar months (October 9 update).
- Compact five-sheet export (Members 8 columns, Memberships 10, Attendance 5, Training 6).
- Saved package/discount detail edits removed; creation/status changes remain.

Twenty unit tests, lint and build pass. Browser verification at desktop and 390px mobile confirmed four drilldowns, theme reload persistence, analytics filters and Excel download, Guest creation and conversion to Staff with PT, both boundary dates in Staff calendars, no catalogue edit action, modal scroll isolation and no page errors. Historical verification above remains documented separately from these current checks. Metric definitions and reporting caveats: [Metrics](METRICS.md).
## September 22 update

Custom Analytics date ranges, Analytics-only export, same-day saved check-in time corrections with reason/original time/audit, red-neutral UI, and date-column 1/0 attendance export are implemented. The selected date range includes its endpoints and may include today (partial-day notice). Matrix exports include zero-visit members; 0 means no matching recorded visit. Underlying attendance remains row-based and unique per member/day. Live authorization and date/backdated-entry policies are still pending. See [current requirements](PROJECT_BRIEF.md#september-22-ui-and-reporting-supersedes-earlier-reporting-details).

## September 23 — current access and UI (supersedes earlier restrictions)

- Local login UI/role flow was explicitly selected; Supabase is still unconnected.
  First use creates one Super Admin (no default credentials). Super Admin can
  create/delete Admin accounts and edit saved non-legacy packages/discounts.
  Both roles share all other current member, attendance, catalogue create/status,
  analytics and export actions. Historical catalogue definitions remain preserved.
- Accounts are separate from gym records at `community-fitness:local-accounts:v1`.
  Passwords use salted PBKDF2-SHA256 (210,000 iterations), not plaintext.
  Sessions are per-tab sessionStorage, expire after eight hours, and deleted
  accounts lose their session on the next check. Login is a local workflow,
  NOT a trusted authorization boundary; browser storage is user-editable.
  Clearing storage loses local accounts/data. There is no local password recovery.
  Do not use this as protection for real member data on shared devices.
- Catalogue editing checks the local Super Admin role and stale updated timestamp,
  logs before/after changes, and leaves existing membership/PT snapshots untouched.
  Membership creation and attendance/audit actor IDs identify the signed-in account.
  Deleted account audit history and member data are retained.
- Dashboard has five cards in one desktop row. New / Renew counts valid membership
  transactions **saved today in Myanmar time**, not membership start dates.
  First membership is New; subsequent memberships are Renew. Profile-only/Guest
  creation does not increment it. Two saved memberships for a person count twice.
  Drilldown shows type, person, package/plan and save time. Narrow screens scroll
  the same card row horizontally.
- Page headers use only an icon and heading (functional controls remain).
  Sidebar uses the supplied original PNG on a light gradient in both themes.
  Student ID input/detail appears only for Student; previously stored values
  are retained when changing category.
- Check-in confirmation offers an optional same-day Myanmar time; blank uses now.
  Invalid/future times are rejected. Existing presence is never overwritten by a
  repeated check-in. Manual entries retain recorded-at time and time-source.
- Saved check-in time correction is reached from an already-checked-in dialog
  or Member profile → Attendance history → Edit time. Reason, same-date constraint,
  original timestamp, stale-edit rejection and before/after audit are retained.
- Analytics no longer includes the reconnect list or attendance-record table.
  Charts, custom dates, metrics and Analytics-only Excel export remain.
September 23 verification: 27 Node tests pass, including local account setup/login/deletion/expiry, password hashing, Admin allow/deny behavior, Super Admin snapshot-safe catalogue edits, manual/default check-in times and New/Renew Myanmar-day totals. Isolated-browser checks cover both roles, creation/deletion, catalogue editing, conditional Student ID, manual time correction, drilldowns, Excel download, reload, desktop/mobile themes and modal isolation. Test people/accounts are fictional and confined to the isolated browser.
