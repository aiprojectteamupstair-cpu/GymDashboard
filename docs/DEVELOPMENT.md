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
