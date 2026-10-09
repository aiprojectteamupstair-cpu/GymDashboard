# Development and production

Current handover workflow, October 5, 2026. This supersedes older backend setup notes.

## Roles and attendance calendar

Account labels are now Admin (stored `super_admin`) and Staff (stored `admin`).
Existing identities, passwords, role codes and Staff permissions are unchanged.
The repeated workspace record-count notice and duplicate sidebar role line are removed.
Dashboard attendance follow-up now sits between the weekly chart and community breakdown.

Admin can open Members -> member profile -> Edit attendance and mark past Myanmar
dates, enter a time for each new visit, and supply a reason. Existing visits can
be voided, restored or have their time corrected. Today uses the existing check-in
flow. Batches are atomic, limited to 32 dates, protected against stale updates and
safe to retry. Voids retain the row; restoration reuses its ID. Original times,
snapshots and import provenance are preserved. New historical visits use the
member's current code/category snapshot, not an inferred historical category;
no membership eligibility or Guest trial is fabricated for a retrospective edit.
Staff retains the existing time-correction workflow but cannot use the new calendar.

Cloud migration `20261005084758_admin_attendance_calendar` is applied on
`snbfdktwrgzhwjqmyhdz`; the command and account endpoints are deployed with JWT
verification enabled. Browser roles cannot call the calendar RPC directly.
No existing business records or Auth identities were changed. A rollback-only
cloud test passed add/retry/void/restore. The updated Vercel frontend still needs
deployment and real authenticated browser acceptance. Security advisor reports
the existing leaked-password-protection warning; its setting was not changed.

Verification: 86 unit tests, lint, production/local builds, isolated real
PostgreSQL API and calendar SQL tests, and synthetic-API desktop/mobile browser
checks (including Staff restriction, drilldown and mobile saving). Run:

```powershell
npm test
node --test server/local/api.test.mjs server/supabase/attendance-db.test.mjs
node scripts/test-attendance-ui.mjs
```

The UI check requires Playwright and installed Microsoft Edge, with the local dev
server running. `PLAYWRIGHT_MODULE` can point to a bundled Playwright `index.mjs`;
`UI_URL` overrides the default `http://127.0.0.1:3000/`. It intercepts API calls
with fictional records and never writes to either workspace database.

## Local development

```powershell
npm install
npm run dev
```

Vite starts the existing local PostgreSQL database and `/api/local/` API.
No cloud connection, hosted relay URL or environment variables are needed for dev.
Database credentials and persistent records remain private under `.local-db/`.
Never delete that folder to restart. Local accounts and records are independent
of production. No data is automatically copied between databases.

The root contains exactly two environment files:

- `.env.example`: committed template with a placeholder public key.
- `.env.local`: ignored developer settings, used for local production builds.

Copy `.env.example` to `.env.local` on a new checkout and supply the selected
project's public publishable key if you need to build production locally.
Backend selection comes from the command, not `VITE_BACKEND` in an env file.

## Vercel production

Set these in the Vercel project's Environment Variables for Production and Preview:

```text
VITE_SUPABASE_URL=https://snbfdktwrgzhwjqmyhdz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<selected project's public publishable key>
```

Vercel uses `npm run build` and `dist/`, as configured in `vercel.json`.
`.env.local` is excluded from deployment; Vercel supplies its own values.
Only a public publishable key belongs in `VITE_*`; privileged keys stay server-side.
The selected cloud project remains enforced to prevent routing existing records
and credentials to a different database by mistake.

Cloud requests use the website's `/supabase` Vercel function, which contacts
Supabase from Vercel. The relay remains for VPN-free browser access; development
does not depend on it. No `SUPABASE_RELAY_ORIGIN` setting is used.
Auth, RLS and trusted Edge Functions continue to enforce production access.

For initial owner credentials supplied through server-only Vercel variables,
see [Super Admin setup](SUPER_ADMIN_SETUP.md). This requires the new service-only
bootstrap migration; no production credentials are committed.

## Commands

| Command | Backend |
| --- | --- |
| `npm run dev` | Local PostgreSQL |
| `npm run build` | Supabase production bundle |
| `npm run preview` | Production bundle, with the same relay handler running on this PC |
| `npm run dev:local` | Alias for local PostgreSQL development |
| `npm run build:local` / `npm run preview:local` | Local PostgreSQL bundle in `dist-local/` |
| `npm run db:start` / `npm run db:stop` | Start/stop PostgreSQL, preserving records |

Production preview still requires this PC to reach Supabase; it may encounter
the previously observed network timeout. This does not affect local development.
To test the Vercel route, use an actual Vercel deployment, then run:

```powershell
npm run check:supabase -- https://YOUR-DASHBOARD.vercel.app
```

Verify real production login and authorized reads/writes after deployment.
The handover's earlier timeout and account-link findings are historical; this
cleanup does not establish current cloud reachability or change Auth accounts.

## Checks

### October 9 Verification

The active local and hosted UI share these routes:

| Screen | Path |
| --- | --- |
| Dashboard | `/` |
| Members | `/members` |
| Member profile | `/members/:id` (stable internal member ID) |
| Check-in | `/check-in` |
| Analytics | `/analytics` |
| Packages & Discounts | `/packages-discounts` |
| Staff accounts (Admin only) | `/staff-accounts` |

Tabs are native links with same-tab History API navigation. Reload and browser
Back/Forward preserve the page; sign-in retains the requested deep link. Explicit
sign-out returns to `/`. Unknown paths, missing members and unauthorized account
pages show clear states after authentication. URL navigation does not grant access.
Vercel's SPA fallback uses its documented
[negative-lookahead rewrite syntax](https://vercel.com/docs/project-configuration/vercel-json#negative-lookahead)
and excludes `/api`, `/supabase`, `/assets` and file paths. The relay remains first.

All member-category profile calendars and editors now use calendar months,
including February/leap years. Staff/Employee no longer has overlapping 25th-to-25th
periods. Stored attendance, history, category-at-visit filters and export data are
unchanged; only the workbook's calendar explanation was updated.

- 92 unit tests, lint and both production/local builds passed.
- `scripts/test-routing-ui.mjs`: synthetic sign-in/deep links, every tab reload,
  profile history navigation, canonical URLs, sign-out isolation, route denial,
  not-found states and Staff month boundaries passed on desktop/mobile. Screenshots
  under ignored `.local-db/ui-checks/` were visually checked.
- Existing `scripts/test-attendance-ui.mjs` check-in, renewal, DMY, unknown-history
  and Admin/Staff attendance-editing regressions passed with native link selectors.
- Browser tests use synthetic intercepted API responses; no real members, visits,
  Auth identities, database policies or cloud deployment were changed. Vercel
  redeployment and real authenticated hosted deep-link checks remain pending.

### October 6 Verification

- Fixed profile action callbacks and renewal member binding. Profiles tolerate
  imported unknown start dates and package snapshots; stored histories stay intact.
- Admin and Staff can add, correct, void and restore past attendance. Account
  management and editing saved catalogue definitions remain Admin-only. Cloud migration
  `20261006111224_staff_attendance_calendar` and `gym-commands` v4 are deployed with
  JWT verification. Browser/anonymous RPC execution remains denied.
- Default dates and input fields use DD/MM/YYYY. Numeric typing inserts separators;
  calendar selection, invalid dates, min/max dates and ISO payloads remain supported.
- Export styling follows the black/gray/white/red reference. Attendance zero cells
  retain numeric zero but render blank; red numeric ones mark recorded presence.
  All five sheets, period/category population, histories and totals are unchanged.
  Text phones/vouchers retain leading zeroes, and date cells use `dd/mm/yyyy`.
- 89 unit tests, lint, Supabase/local builds, isolated real PostgreSQL API and SQL
  checks passed. Run the API and SQL test files sequentially to avoid racing the
  shared PostgreSQL launcher. A cloud rollback-only Staff test verified add, retry,
  time correction, stale rejection, void and restore; no test records remain.
- `scripts/test-attendance-ui.mjs` verifies synthetic desktop/mobile check-in,
  renewal, unknown history, DMY entry and both roles' calendar actions. Set
  `PLAYWRIGHT_MODULE` to the bundled Playwright entrypoint. Browser tests do not
  write to the real workspace. Use an ignored temporary directory on D: when C:
  lacks space; Vite now excludes private database/import folders from its watcher.
- `scripts/test-export-visual.mjs` imports a synthetic app export, reconciles its
  attendance total and renders all five sheets with the bundled Artifact Tool.
  Set `BUNDLED_NODE_MODULES` to the loader's dependency directory. Preview importer
  rendering can normalize numeric-looking text; independent saved-XLSX checks
  verified original string types and leading zeroes in phones and vouchers.
- No member data, Auth identities, credentials or unrelated permissions changed.
  Vercel frontend redeployment and real authenticated hosted-browser acceptance
  remain pending. Existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  remains unchanged; the security advisor reported no other findings.

```powershell
npm test
npm run test:local
npm run lint
npm run build
npm run build:local
```

`test:local` uses a separate temporary database for API integration checks.
October 5 verification: 72 automated tests, the real PostgreSQL API integration
check, lint and both builds passed. An HTTP smoke check confirmed the served dev
frontend selects local mode and the local workspace API rejects unauthenticated
requests. Built bundles were checked for their respective cloud/local selection.
The Windows PostgreSQL launcher now avoids inherited pipes that kept startup
pending and bounds control-command execution to 40 seconds.
See [local database details](LOCAL_POSTGRES.md) and [hosting](VPN_FREE_HOSTING.md).
Environment loading follows [Vite's documented behavior](https://vite.dev/guide/env-and-mode).
The hosted function uses [Vercel's Node runtime](https://vercel.com/docs/functions/runtimes/node-js).
