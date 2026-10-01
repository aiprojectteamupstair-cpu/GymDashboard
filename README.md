# The Community Fitness dashboard

React + Vite dashboard for The Community Fitness By Strategy First Gym.
Current entry uses Supabase Auth with read-only data loading. Owner Auth setup is
not complete because this machine cannot reach the project's HTTPS Auth endpoint.
See [connection status and setup](docs/SUPABASE_WEB_CONNECTION.md).
Updated September 21, 2026: category-based IDs, Guest conversion, package/plan/
discount selections, PT and create/status-only catalogues.

## Run locally

```bash
npm install
npm run dev
```

Open the HTTP URL shown by Vite, not `index.html` as a file URL.
The frontend is browser-local and starts empty with reference catalogues.
Known old fixtures are removed on load after a raw backup; user-created history
is retained. Real member information is now in Supabase, but production Auth and
the frontend data adapter are not connected yet. See the
[September 30 import report](docs/MEMBER_IMPORT_2026_09_30.md).

## Available workflows

- Dashboard, member directory/profile, daily check-in and attendance analytics.
- VIP Customer VC01…, Customer C001…, Student S001…, Staff/Employee E001…, Guest G001….
- Guest trial without membership; convert to a member while retaining identity/history.
- Gym or Swimming Pool Only, 1/3/6/12-month plans and optional discount.
- Optional Gym PT: 5/10 sessions for 1 month, 20 for 2 months, 50 for 5 months.
- Packages & Discounts management with create and Active/Inactive (saved details are immutable).
- Calendar end dates, admin override, renewal history and structured Excel export.
- Desktop/mobile modal forms with background scroll locking.

## Verification and build

```bash
npm test
npm run lint
npm run build
npm run preview
```

Local state remains at `community-fitness:prototype:v1`, payload schema version 2.
An upgrade preserves historical records and backs up the old payload before its
first write. The original `src/App.jsx` and its separate data are retained.

## Project context

- [Requirements and current concept](docs/PROJECT_BRIEF.md)
- [Screen workflows](docs/SCREEN_FLOW.md)
- [Data model and future Supabase work](docs/DATA_MODEL.md)
- [Implementation and limitations](docs/PROTOTYPE.md)
- [Project recall](AGENTS.md)
September 22: red/neutral themes, charts directly below KPIs, Analytics-only Excel export, custom date ranges, audited same-day check-in time correction, and member-by-date 1/0 attendance matrices. The local implementation does not enforce production Admin permissions.
## September 23 local sign-in

Open the dev-server URL. On first use, create your own Super Admin username and password (12+ characters); no default account is shipped. Super Admin → Admin accounts creates/deletes Admin accounts. Both roles share ordinary operations; only Super Admin edits saved catalogue details. Local accounts are stored only in that browser/origin; they do not sync across devices and are not production security. Use a unique local password. Supabase Auth/RLS is still a separate future step. Do not clear browser storage to reset passwords: that also removes local records. See [current implementation](docs/PROTOTYPE.md#september-23--current-access-and-ui-supersedes-earlier-restrictions).
## Supabase schema status — September 29

The initial schema is deployed to **The Community Fitness's Database**. This is
table creation plus confirmed reference catalogues, not a live frontend cutover.
No member data or local accounts were uploaded. See [Supabase status and verification](supabase/README.md).
