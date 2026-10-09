# Project context and working rules

Last updated: 2026-10-09. Business: The Community Fitness By Strategy First Gym.

## October 9 page routes and normal Staff calendar months

- Active local/cloud UI uses browser URLs: `/`, `/members`, `/members/:id`,
  `/check-in`, `/analytics`, `/packages-discounts`, `/staff-accounts`. Tabs use
  native links; reload, Back/Forward and sign-in retain deep links. Unknown pages
  and missing members have explicit states; Staff cannot open account management.
- Vercel SPA fallback excludes API, Supabase relay and static-file paths; the
  existing fixed-project relay rewrite stays first. No deployment performed.
- All profile attendance calendars and editors now use the 1st through the last
  day of the selected month, including Staff/Employee. This supersedes all older
  25th-to-25th instructions below. Stored visits, category-at-visit filters,
  permissions, audit history and Excel data remain unchanged.
- 92 unit tests, lint, both builds and synthetic desktop/mobile route/calendar
  and existing workflow browser checks passed. See docs/DEVELOPMENT.md. Vercel
  redeployment and real hosted authentication/deep-link verification remain pending.

## October 6 workflow repairs and Staff attendance access

- Profile Check in/Renew now pass member IDs rather than click events. Renewal
  from a profile fixes the member and shows identity without a selector; the
  directory's general renewal action retains selection. Unknown imported start
  dates and missing package snapshots render without crashing or altering data.
- Both Admin (`super_admin`) and Staff (`admin`) may edit past attendance. Other
  Staff permissions remain unchanged. Migration `20261006111224_staff_attendance_calendar`
  and `gym-commands` v4 are deployed on the approved project with JWT verification.
  Service-only RPC grants, active-account checks, reasons, timestamps, stale-write
  rejection and audit retention remain. Rollback-only cloud Staff add/retry/edit/
  void/restore passed; zero test members/audits retained. No real records changed.
- UI date fields use DD/MM/YYYY with numeric typing and a calendar picker; stored
  dates stay ISO. Excel uses DMY dates, black headers, alternating gray/white rows
  and red presence marks. Numeric attendance zeros display blank using a number
  format, retaining counts and the original five-sheet data layout.
- Verified 89 unit tests, isolated PostgreSQL API and SQL tests, lint, both builds,
  synthetic desktop/mobile flows and all five exported sheet previews. Saved XLSX
  phone/voucher leading zeroes independently verified. Vite ignores private runtime
  folders to avoid Windows locked-file watcher crashes. Vercel frontend deployment
  and real authenticated hosted browser acceptance remain pending. See
  [development checks](docs/DEVELOPMENT.md#october-6-verification).

## October 5 updated workbook import

- User-authorized October 3 member and July-October attendance workbooks imported
  into **TCF User's Database**, `snbfdktwrgzhwjqmyhdz`. Totals: 455 members,
  539 memberships, 22 PT purchases, 5,432 attendance. Added 32/55/0/1,083;
  updated 52 profiles and filled one previously unknown membership expiry.
- C123 remains deleted. Prior confirmed C123/C124 attendance resolution retained.
  G008 converted to E062 on its stable UUID; former codes/history retained.
  Conflicting source G72-G75 allocated G084-G087 without stealing existing codes.
  Unconfirmed blank-ID/spelling matches remain separate with review remarks.
- All 4,349 old visits, 483 other memberships and 22 PT purchases verified unchanged.
  New visits are date-only (`import_date_only`), not fabricated arrival times.
  Unclear marks do not become visits; prior data absent from source is not deleted.
  No Auth/schema/grant/deployment/local DB changes. Private backups and replay-safe
  SQL remain ignored. See [import report](docs/WORKBOOK_UPDATE_2026_10_05.md).

## October 5 roles, dashboard and attendance calendar

- UI role names are Admin (`super_admin`) and Staff (`admin`). Keep persisted role
  codes and existing Staff authority unchanged. Removed global loaded-records
  notice and duplicate sidebar role. Attendance metrics now sit between the weekly
  chart and community breakdown with responsive follow-up rows.
- Admin-only member-profile calendar supports reasoned past-day add, void, restore
  and time correction in atomic batches. New visits require explicit Myanmar time;
  today remains the ordinary check-in flow. Retain original timestamps, snapshots,
  provenance, voided rows and audit history. Stale writes and Staff requests fail.
- Migration `20261005084758_admin_attendance_calendar` and both Edge endpoints are
  deployed on the approved project; JWT verification and service-only RPC remain.
  Rollback-only cloud add/retry/void/restore passed; no real data/accounts changed.
  Vercel frontend redeployment and real authenticated browser acceptance pending.
- Verified 86 unit tests, lint, both builds, real PostgreSQL API/SQL isolation tests
  and synthetic desktop/mobile browser flows. See docs/DEVELOPMENT.md. Security
  advisor reports existing leaked-password protection disabled; not changed.

## October 5 handover cleanup (supersedes older backend/env instructions)

- Hosted follow-up: user reports successful login followed by Workspace unavailable
  with `failed to parse filter (rest/v1/app_staff)`. Fixed a relay query leak:
  legacy Vercel `path` capture matching the resolved route is stripped before
  forwarding to PostgREST. Rewrite capture now uses the reserved
  `__supabase_path` name, which the relay already removes. Real column filters,
  RLS credentials and pagination are preserved. 81 tests, lint/build passed,
  including SDK workspace loading through simulated Vercel routing. Updated
  deployment and real authenticated workspace rendering remain unverified.

- Follow-up: user requested Vercel env credentials for the initial Super Admin.
  `server/supabase/bootstrap.mjs` is imported ONLY by `api/supabase.js` and uses
  `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (12–128) and `SUPABASE_SECRET_KEY`.
  Normal Supabase authentication remains authoritative; existing passwords are
  never reset. Exact configured credentials trigger initial Auth creation/linking.
  Migration `20261005030000_super_admin_bootstrap.sql` adds a service-only atomic
  RPC that verifies confirmed/non-deleted/non-banned Auth identity, preserves an
  unlinked owner profile and blocks staff reassignment/reactivation. No cloud
  migration/account/deployment performed; see [owner setup](docs/SUPER_ADMIN_SETUP.md).
  Verified 78 unit tests, real PostgreSQL concurrency/access tests, lint/build and
  browser-bundle exclusion. The whole initial-auth/create/link sequence is bounded
  to 10 seconds and retries can resume an already-created identity.

- Continue in English, as explicitly requested by the user.
- User selected local PostgreSQL development and Supabase on Vercel production.
  `npm run dev` always uses the existing local API/database, even when cloud env
  settings exist. `npm run build` always selects Supabase and validates cloud config.
- Root env files: committed `.env.example` and ignored `.env.local`. Vercel uses
  its own `VITE_SUPABASE_URL` and public `VITE_SUPABASE_PUBLISHABLE_KEY` settings.
  Do not restore `.env.supabase`, extra example files or a `VITE_BACKEND` env switch.
- Production retains the fixed-project, limited `/supabase` relay for VPN-free
  browser access. Local development does not depend on a hosted relay.
  Production preview runs the relay locally and needs this PC's cloud reachability.
  `SUPABASE_RELAY_ORIGIN` is removed. Local and cloud data/accounts stay independent.
- No database records, Auth identities, grants or deployments were changed by
  the cleanup. Do not claim cloud connectivity/authentication is verified.
- Current setup: [development and deployment](docs/DEVELOPMENT.md).
- Verified 72 tests, real PostgreSQL API integration, lint, both builds and local
  HTTP backend/auth-denial smoke checks. Windows pg_ctl startup now avoids
  inherited-pipe hangs and has a bounded control-command timeout.

## October 2 Supabase reconnection (supersedes disconnection and old target restrictions)

- Latest user requirement: dashboard must work without a VPN. Browser Supabase SDK now uses same-origin `/supabase`, with the canonical project session-storage key. `api/supabase.js` and `server/supabase/relay.mjs` implement a fixed-project, route/method-limited Vercel relay; no privileged keys, credential/body logging, redirects or cached responses. Local Vite forwards only to `SUPABASE_RELAY_ORIGIN`; missing deployment returns 503, never a direct Supabase fallback. Vercel deployment is prepared but not deployed: no hosting login/link was available, and the Vercel plugin was suggested for installation/connection. 71 tests/lint/build and synthetic browser same-origin checks passed. Real VPN-free access remains unverified until deployment and endpoint checks pass. See [VPN-free hosting](docs/VPN_FREE_HOSTING.md). Do not ask the user to use a VPN as the solution.
- Latest failed-fetch follow-up: `src/supabase/transport.js` bounds requests to 12 seconds and replaces opaque network failures with actionable messages; HTTP credential errors and caller cancellation are preserved. `npm run check:supabase` is a credential-free DNS/Auth reachability test. 63 tests, lint/build and synthetic browser error/retry checks passed. Real network check still times out; user was asked to connect an available VPN or alternate network. Do not report login as fixed until actual reachability and authentication succeed.
- User explicitly selected **TCF User's Database**, `snbfdktwrgzhwjqmyhdz`, and requested dashboard reconnection. This is now the approved target; earlier diagnostic-only restrictions are superseded.
- `src/backend.js` selects the backend. `npm run dev`, `build` and `preview` use Supabase mode and the tracked public configuration in `.env.supabase`. Only the publishable key is client-side. `npm run dev:local`, `build:local` and `preview:local` retain the separate local PostgreSQL workspace; its data is unchanged.
- Both `gym-commands` and `admin-accounts` are deployed on the selected project with JWT verification enabled. Existing schema/RPCs/data were reused, not imported or reset. Read-only connector checks show 423 members, 484 memberships, 22 training purchases, 4,349 attendance, and RLS on all 12 public tables.
- 59 tests, lint, Supabase/local builds and rollback-only live access-denial tests passed. Security advisor returned no findings. Real authenticated browser operations remain unverified.
- The selected project had zero Auth users at the latest verification, despite the user reporting account creation. The existing Super Admin profile has null user_id. Verify the exact user-approved email from the conversation, confirmed/non-deleted/non-banned identity and correct project before linking; do not reset or fabricate an account. Browser API reachability still times out from this computer.
- C drive is full. Workspace npm cache now uses D drive through `.npmrc`; do not delete user files to free space. See [reconnection status](docs/SUPABASE_RECONNECTION_2026_10_02.md).

## Supabase disconnection (supersedes backend instructions below)

- User requested all project Supabase connections removed. App now exclusively uses `src/local/backend.js` and the PostgreSQL API for development and built previews. No environment flag enables remote Auth/database access.
- SDK, local Supabase/bootstrap env settings, provisioning/network npm commands and Vite/Vercel proxy routes removed. Historical Supabase SQL, functions and offline tests retained as inactive reference. Remote databases/data and existing cloud deployments were not deleted or modified.
- `npm run dev` or `npm run build` then `npm run preview` serves the local workspace. Read [current setup](docs/LOCAL_POSTGRES.md); older cloud-connect instructions are historical.

## October 2 local PostgreSQL (supersedes active-entry/backend notes below)

- Follow-up network check: [October 2 results](docs/SUPABASE_NETWORK_2026_10_02.md). Requested `snbfdktwrgzhwjqmyhdz` endpoint resolves consistently through system/public DNS, but both gateway IPs time out on TCP 443 over Ethernet with visible TAP VPN adapters disconnected. No HTTP 401/no-key response received. Missing opt-in Vite proxy fixed; hosted proxy target mismatch now fails the build. 59 tests/lint/build pass; remote network access remains unresolved. Do not switch the approved project to the diagnostic host.

- User selected a separate local PostgreSQL database; hosted Vercel builds will use Supabase via environment variables. `npm run dev` defaults to the local backend; production builds default to Supabase and require explicit URL/publishable key. See [local setup](docs/LOCAL_POSTGRES.md).
- Active UI remains `src/supabase/LiveApp.jsx`, now sharing the local API client or Supabase client based on environment. Local mode uses server-verified login, HttpOnly sessions and real PostgreSQL, not browser-storage authentication.
- Project-local PostgreSQL 18.4 listens on 127.0.0.1:55432, database `community_fitness_local`; private persistent files and generated DB credentials are under ignored `.local-db/`. Vite denies HTTP access to that folder and private import files. Never delete this folder to restart.
- Local database starts with reference catalogues, zero people and the user-requested local Super Admin (hashed credential seed on server only). No remote/browser data was copied; no live Auth account, grants, data or deployment changed. Local and hosted accounts/data are independent.
- `npm run db:start`, `npm run db:stop`, `npm run test:local` manage/verify it. Isolated real PostgreSQL API checks cover permissions, idempotency, concurrent check-in, failed-conversion rollback and account/session revocation. Shared 57 tests, lint/build and browser login/reload checks passed. This does not resolve the previously reported remote network issue.

## October 1 attendance and Admin API (supersedes earlier pending notes)

- Latest follow-up: [live operations](docs/LIVE_OPERATIONS_2026_10_01.md) supersedes the read-only notes below. `gym-commands` deployed for transactional member/membership/PT/check-in/time/catalogue writes; `admin-accounts` v2 adds confirmed Admin deletion with staff/audit retention. Browser direct writes remain closed. Migrations 20261001104539 and 20261001105350 are applied. 56 tests and rollback SQL/synthetic browser checks pass; real authenticated end-to-end acceptance and VPN-free route remain blocked by local API TCP timeouts. Do not claim the network issue is fixed.

- Imported 4,349 historical presences: July 1,139, August 2,064, September 1,146; July 1–September 16. Explicit assumed 18:00 Myanmar timestamps are labelled and excluded from arrival-hour metrics. No absence inferred from trailing blanks. See `docs/ATTENDANCE_IMPORT_2026_10_01.md`.
- User explicitly authorized permanent deletion of duplicate C123 and its one membership; private backup retained. C124 remains and receives 26 resolved attendance dates; no membership history merged. Current totals: 423 members, 484 memberships, 22 PT purchases, 4,349 attendance.
- Latest observed member-info source date September 21; attendance September 16. These are observed cutoffs, not proof of complete source coverage.
- Deployed `admin-accounts` Edge Function with JWT verification, live enabled Super Admin checks, list/create only, password minimum 6, server-only privileged credentials and atomic staff/audit provisioning. Migration `20261001040433_admin_provisioning_and_attendance_import.sql` grants only narrowly scoped service operations; browser writes remain denied. Admin deletion and member/check-in/catalogue write APIs remain pending.
- 52 tests, lint and build passed. Synthetic browser create/list flow passed; actual authenticated Edge creation still needs user verification because local project HTTPS connections time out. Do not claim a real Admin was created. VPN/network issue unresolved; no network settings changed. Never expose data or privileged keys as a workaround.

## October 1 webpage connection — setup incomplete

- Focus refresh fix: live same-user refresh is background/deduplicated/throttled, retaining memory-only verified data briefly on transport errors with a notice; confirmed access denial/sign-out/identity change clears it. Restored Check-in, Packages & Discounts and Super Admin-only Admin accounts tabs. Trusted write APIs remain pending; accounts tab shows only the caller, explicitly not a full staff list. 48 tests and synthetic-browser checks pass. See `docs/SUPABASE_WEB_CONNECTION.md`.

- Latest repair: missing-profile error exposed a null owner `user_id`; the approved email now has confirmed Auth UUID `de3a0edd-e14a-44fa-911d-14787508c0a2`. Verified exact email and non-deleted/non-banned status, then relinked the existing enabled Super Admin profile with `staff.auth_relinked` audit. No account reset or policy/grant change. Current UUID passes 424/485/22 RLS reads; former UUID sees zero staff/members. Browser rendering still awaits user retry. This supersedes earlier linked-account details below.

- Latest: user created the approved Auth account; exact email and confirmed/non-deleted/non-banned status were verified. Prepared staff profile `e0de280c-5ac0-4921-9e94-d4f03f4efbf7` is now linked and enabled as `super_admin`, with a provisioning audit event. This supersedes pending/unlinked notes below. Do not recreate/reset the account.
- Rollback-only authenticated-role SQL tests passed: owner sees 424 members/485 memberships/22 PT; disabled/unregistered identities see zero members, direct inserts stay denied. No real browser session tested. Local HTTPS Auth endpoint still times out. Advisor now flags leaked-password protection disabled; no settings changed automatically.

- Active entry now loads `src/supabase/LiveApp.jsx`, with Supabase Auth and paginated read-only RLS-backed loading. Local login is no longer the active entry; no local accounts were migrated/deleted. The older local UI remains in source.
- Auth account creation is BLOCKED by local HTTPS timeouts to the project endpoint (Node/curl/browser). Do not claim an email was sent or an account created. User approved the owner email in the conversation; do not hardcode it or any password into the frontend.
- Pending Super Admin staff profile `e0de280c-5ac0-4921-9e94-d4f03f4efbf7` is disabled with null user_id. Link only the exact approved Auth identity after creation and verification, then enable it. No RLS/grants were opened.
- Read adapter handles former codes/source expiry and excludes imported history from today's New/Renew. Writes are blocked in the live UI; real login/positive role tests remain pending. Vite port is now 3000; verify Supabase redirect allowlist before email-link use.
- See `docs/SUPABASE_WEB_CONNECTION.md` for implementation, 43 passing tests and the remaining setup. Do not bypass the Auth network failure by exposing member tables or copying real data into public assets.

## September 30 real-member import (supersedes no-import and fixture notes below)

- User authorized `01_Members_Updated.xlsx`; its `Recorded Date` is confirmed as Start Date. Imported to `axbfwmrrxsgzevvqshdu`: 424 members, 485 memberships, 22 PT purchases; 84 other history rows retained in member remarks/provenance. All 591 info rows reconciled, zero field mismatches. Attendance remains empty and awaits separate files.
- Blank categories/IDs provisionally Guest. Guest codes now G001...; 70 previous short codes remain aliases. Source expiry, unknown dates/plans, shared vouchers and original notes are preserved. Do not infer missing dates, merge same-name people or turn day-pass notes into attendance.
- Live packages are exactly Gym and Swimming Pool Only; guest digits = 3. No schema/grant/Auth changes. RLS still closed to unaffiliated clients. Frontend is still local and NOT connected to real data.
- Local app now starts empty; `dataLifecycle.js` removes only known fixture people/dependents, reduces old catalogues to the two current packages, preserves non-fixture histories and normalizes Guest codes. It backs up raw storage at `community-fitness:prototype:v1:before-real-members-v1` before saving. Test fixtures are no longer a production dependency.
- Private workbook/plan/SQL/review files live only in ignored `.private-imports/`; never commit, publish or put their personal data in the frontend. See `docs/MEMBER_IMPORT_2026_09_30.md` for reconciliation and follow-up work. Do not rerun a different import or reset live data automatically.

## September 30 changes (supersedes payment/reporting rules below)

- Payment methods are no longer collected, displayed or exported. Historical local payment fields are preserved, not erased. Supabase optional columns and empty reference table are retained unused; no migration or write-grant change was necessary.
- Active memberships standalone card is replaced by one attendance-status card with three clickable circles. Green counts all non-archived Active members; Yellow/Red are subsets with last recorded visit 10–20 / over 20 Myanmar calendar days ago. Ends today remains distinct. Unknown/no-visit history is a separate drilldown, never an invented absence duration. Do not sum the three overlapping counts.
- Attendance Excel has merged month/year headers above day-number columns; freeze first two rows and first three identity columns. Memberships exports nonunique text Voucher No. instead of payment, preserving leading zeroes and each renewal's voucher. Shared vouchers never merge people.
- New local Admin passwords require 6–128 characters; Super Admin setup retains 12–128 and salted hashing. No existing accounts/passwords reset. Requested fixed Super Admin login is awaiting safe-setup clarification; no plaintext credentials committed or live Auth account created.
- Frontend remains local. Real Auth, trusted CRUD/check-in APIs and live write permission tests remain pending. The approved member workbook import is described above; no demo people were uploaded.

## September 29 live schema status (supersedes earlier unselected-project notes)

- Supabase project `axbfwmrrxsgzevvqshdu`, **The Community Fitness's Database**, is verified and has the initial schema applied via the Supabase plugin.
- Remote migration `20260929094219_community_fitness_foundation` is recorded locally under `supabase/migrations/`.
- 12 public tables: original 11 collections plus `member_codes` for current/former ID ownership. Only confirmed reference catalogues are seeded (5/2/4/3); no people, attendance, accounts, passwords or Excel rows uploaded.
- RLS enabled everywhere; enabled-staff SELECT policies only. Browser and service-role direct write grants intentionally closed until trusted APIs are built. Frontend still uses local storage/local login, NOT Supabase.
- See `supabase/README.md` for verified checks, mappings and remaining work. Two rollback-only live SQL suites passed; security advisor has no findings. Positive Auth role tests and concurrent write APIs remain pending.
- Do not upload local demo records or old workbook rows, bootstrap accounts, or open write grants automatically. No source passwords in files.

## Read first

- `docs/PROJECT_BRIEF.md`: confirmed requirements and pending decisions.
- `docs/SCREEN_FLOW.md`: screens, reception and membership workflows.
- `docs/DATA_MODEL.md`: data model and future Supabase implementation checks.
- `docs/PROTOTYPE.md`: implemented UI and development limitations.
- Continue in Burmese. Pending policies remain pending even when a UI demonstrates them.

## Current stage

- Interactive local dashboard. The webpage-start notification has already been given.
- The September 19 concept supersedes the earlier package/category catalogue.
- Active entry: `src/main.jsx` -> `src/prototype/PrototypeApp.jsx`.
- UI prototype/demo banners and the old Settings/reset screen were removed at the user's request. This does not mean a production database or authentication is connected.
- Storage remains `community-fitness:prototype:v1` for compatibility; payload schema is version 2. Eleven local collections extend the original eight with plans, discounts and training purchases.
- Supabase schema and approved member information are live in the selected project; the frontend adapter remains unconnected.
- Development fixture people are fictional. Keep their provenance in developer documentation, not repeated product UI banners.
- Original `src/App.jsx`, `src/exportWorkbook.js` and their separate browser data are retained.
- Reference workbook paths are recorded in the brief.

## Confirmed current concept

- Categories and readable unique IDs: VIP Customer VC01…, Customer C001…, Student S001…, Staff/Employee E001…, Guest G001….
- Keep a stable internal UUID independently of these IDs. Category changes allocate a new category code while previous codes remain linked/searchable; attendance and membership history remain on the same person.
- Packages: Gym (All Classes, Swimming Pool, Sauna); Swimming Pool Only.
- Membership plans: 1, 3, 6 or 12 calendar months. Duration belongs to the plan.
- Discounts: Condo 50%, Student 20%, Student 50%. Select an optional discount separately from package and plan.
- Admin can create packages and discounts (details are immutable after saving), and mark them Active/Inactive. Only active records appear in new/renew membership dropdowns; history keeps snapshots.
- Gym offers optional Personal Trainer (PT; Rehab is the same service): 5/10 sessions valid for 1 month, 20 for 2 months, 50 for 5 months. All start on the membership start date (user confirmed).
- PT purchase records stay separate from membership, even when entered in the same form. No amount/revenue fields. Per-session usage tracking is not yet requested.
- Guests have a one-day trial and no package/plan/discount requirement. Convert Guest to VIP/Customer/Student/Staff with package, plan and optional discount. Save conversion and membership together.
- Reception finds/identifies a person and records daily presence. No checkout.
- Manual membership start date, automatic calendar end, admin end override with reason.
- No freeze/day transfer workflow. Keep historical special entries in remarks.
- Payment is category only: do not add amounts, balances, prices or revenue.
- Member CRUD, monthly attendance, visual analysis and structured Excel export remain in scope.

## Integrity and pending policies

- Calendar addition uses the original start and clamps the target month's final day. Keep calculated and overridden end dates separately.
- Expiry-day entry eligibility remains pending; show Ends today separately. Other membership eligibility/overlap policies and exact role permissions remain pending.
- One presence per Myanmar calendar day is the attendance implementation direction. Enforce with a unique database constraint when connected.
- Local Guest trial starts at first check-in, allows same-day duplicate lookup and blocks another trial day. Review any trial reissue policy before introducing exceptions.
- Archive/restore keeps history; final deletion/correction/backdate policy remains pending.
- Category ID allocation must become transaction-safe in Supabase; never merge people by name, phone or old voucher.
- Historical Member No. may be a shared voucher; meaning remains unconfirmed.
- Preserve source expiry dates, source references, category/package snapshots and unknown values during imports.
- Old Jul/Aug/Sept labels mean three-month historical memberships. Earlier staff/student/condo labels are historical context, not current selectable packages.
- Local upgrade keeps unknown historical categories disabled for new selection, preserves historical memberships, retires old catalogue options and backs up raw v1 data at `community-fitness:prototype:v1:before-concept-v2` before the first write.
- Required profile fields, payment options, users/devices and permissions remain pending.
- Future Supabase: Auth, enabled staff roles, role-aware RLS, explicit grants, trusted snapshots/audits and privileged keys server-side.
- No live import until target project and reviewed member mappings are available. No source PII or credentials in docs.

## Verification

- `npm test`: calendar/leap years, Myanmar midnight, category IDs, atomic Guest conversion, trial limits, active catalogues, preserved snapshots, PT dates, legacy upgrade, storage failure and Excel reconciliation.
- `npm run lint` and `npm run build` for implementation changes.
- Browser: create/edit/convert/renew, catalogue management, filtered dropdowns, export, reload, former-ID search, desktop/mobile modal scroll isolation and restore.
- Live database concurrency, permission allow/deny and import reconciliation are still required before production use.
- Documentation-only changes require link/diff checks, not an unrelated build.

## September 21 reporting and UI rules

- PT and Rehab are one service; UI says PT. New purchases normalize to `pt`; historical records remain intact.
- Packages/discounts can be created or activated/deactivated, not edited after creation.
- New member action is only in Members. Theme preference is stored at `community-fitness:theme`.
- Staff profile calendars include both 25ths. The shared date appears in both reporting cycles, but the daily attendance row is not duplicated. Other categories use normal calendar months.
- Dashboard is daily operations with four record drilldowns. Analytics uses completed 7/30/90-day periods and preceding equal-period comparisons. See `docs/METRICS.md` for denominators and limitations.
- Excel remains five sheets with 8/10/5/6 operational columns for Members/Memberships/Attendance/Training; no technical IDs or duplicate date columns. Original stored history is not removed.
## September 22 UI and reporting (supersedes earlier reporting details)

- Product UI uses red, black, white and gray in light/dark modes; charts may use other distinguishing series colors.
- Dashboard order: KPI cards, charts, then a larger Today's check-ins panel with compact membership follow-up alongside.
- Export is available only in Analytics. Custom inclusive start/end dates replace the preset-only period; 1–366 days, no future dates. Today is allowed with a partial-day notice. Comparisons use the preceding equally sized period.
- Analytics attendance records have same-day time correction. The user confirmed this means editing stored check-in time, not a time filter. A reason is required; original timestamp plus before/after audit history are retained. Future times and stale edits are rejected. The attendance date, member, snapshots and presence count do not change. Backdated entry/date correction and live role permissions remain pending.
- Attendance Excel is a matrix: Member ID, Name, current Category, then one column per selected date; one row per selected member, numeric 1/0. 0 means no matching recorded check-in, not verified absence. Include zero-visit members. Category selection includes current category members plus people with matching historical category-at-visit records; matrix presence respects the historical visit filter. Other sheets keep these members' valid histories. Headers and the first three identity columns are frozen.
- Tests cover matrix totals, zero-visit members, month/leap-day boundaries, time validation, stale edits, original timestamp and audit preservation. Local role labels are not production authorization.

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
