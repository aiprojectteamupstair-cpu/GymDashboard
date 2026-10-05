# TCF User's Database connection

Latest: the user requires VPN-free access. [Hosted relay implementation and
deployment status](VPN_FREE_HOSTING.md) supersedes direct-browser networking
below. Hosting is prepared but not yet deployed; real connectivity is unverified.

The user selected `snbfdktwrgzhwjqmyhdz` (TCF User's Database, ap-south-1).
This supersedes the previous project selection and diagnostic-only restriction.

## Application

- `npm run dev` serves the Supabase dashboard; the verified server for this work
  uses `http://127.0.0.1:3001` because port 3000 was already occupied.
- `npm run build` / `npm run preview` build and serve Supabase mode.
- `npm run dev:local` / `build:local` / `preview:local` preserve the independent
  PostgreSQL workspace. Local output uses `dist-local/` to avoid replacing the
  Supabase build. No automatic cross-database synchronization exists.
- `.env.supabase` contains only the project URL and public publishable key.
  `config/backend.mjs` rejects other projects, missing keys and secret keys.
  Hosted environment overrides must use this same project and a publishable key.
- Browser requests use Supabase Auth, RLS reads and trusted Edge Functions;
  remote mode does not mount or call the local API. Requests time out after
  12 seconds with an actionable network message. No privileged credentials
  are sent to the browser.
- `.npmrc` keeps npm cache on the workspace drive because C is full.

## Remote state

The project is ACTIVE_HEALTHY. Existing public tables and RPCs were reused.
Observed totals: 423 members, 484 memberships, 22 training purchases and 4,349
attendance records. All 12 public tables have RLS enabled. No data was copied,
deleted or reimported, and no schema migration was applied.

Deployed `gym-commands` and `admin-accounts`, both version 1 with `verify_jwt`
enabled. Each handler independently verifies the token using `auth.getUser`
and checks live staff authorization before privileged actions. Default allowed
browser origins are localhost / 127.0.0.1 ports 3000, 3001, 4173 and 4174.
Hosted sites must add their exact origin to the functions' `ALLOWED_ORIGINS`
secret setting. No hosted site was deployed in this task.

## Verification and remaining setup

- Initial reconnection: 59 automated tests, lint and both production builds passed.
- Login fetch follow-up: 63 tests, lint and Supabase build passed. Synthetic
  browser checks verified a failed connection returns an actionable message,
  permits retry and does not mask invalid-credential responses. No real Auth
  requests were sent by those browser checks.
- Desktop (1366x900) and mobile (390x844) browser checks passed: sign-in renders,
  no page errors or horizontal overflow, selected project/mode verified, and no
  local API requests. These checks did not authenticate a real user.
- Rollback-only live SQL verified anonymous/unknown staff access denial,
  direct-write denial and staff self-promotion denial.
- Security advisor returned no findings; runtime dependency audit found no
  vulnerabilities. Real authenticated CRUD acceptance remains pending.
- Direct HTTPS to this project's REST endpoint still timed out before an HTTP
  response after 8 seconds. Connector access is independent of this browser path.
  No VPN, firewall, DNS or routing settings were changed.
- The latest account check returned zero Auth users, including no match for the
  approved email supplied in the conversation. The existing enabled Super Admin
  profile has no Auth link. The user reported account creation; confirm they used
  this exact project's Authentication > Users screen before linking a confirmed,
  non-deleted and non-banned matching identity. No account was reset or created
  by this task. Do not commit passwords or the owner's email.

Reference: [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth).

## Failed-fetch diagnosis

The exact `/auth/v1/health` endpoint times out before receiving HTTP from this
computer. DNS resolves both gateway addresses. Ethernet is up; the inspected VPN
adapters are disconnected, with no configured system/environment proxy. This
does not identify which part of the route is responsible. A local proxy would
use the same failing outbound path.

`npm run check:supabase` tests DNS and Auth reachability using only the public key,
never an email/password. It returns nonzero for the currently observed timeout.
Repeat after an available VPN or alternate network is connected. The fetch
handling change does not repair upstream connectivity or create an Auth account.
