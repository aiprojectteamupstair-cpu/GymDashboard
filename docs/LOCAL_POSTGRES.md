# Local PostgreSQL workspace

The development app now uses its own PostgreSQL database and server-verified
email/password login. `npm run dev` starts the database and the Vite API together.
The terminal prints the available website URL, starting at port 3000.
No Supabase account or internet connection is needed after dependencies install.

The requested Super Admin credentials are seeded only when the database has no
accounts. Passwords use salted PBKDF2-SHA256, 210,000 iterations. Sessions use
HttpOnly, SameSite=Strict cookies and expire after eight hours. Account deletion
revokes sessions and retains audit history.

## Database

- Database: `community_fitness_local`, PostgreSQL 18.4.
- Listener: `127.0.0.1:55432`, SCRAM authentication.
- Data: `.local-db/postgres/`; connection settings: `.local-db/connection.json`.
- The database password is randomly generated, separate from the app login.
- `.local-db/` is private and ignored by Git. Do not delete it to restart the app.
- `npm run db:start` initializes/starts without resetting records.
- `npm run db:stop` cleanly stops PostgreSQL and retains records.
- Stop the database before making a filesystem backup of `.local-db/`.

The `gym_local` schema contains a table per existing domain collection, with
JSONB records preserving the existing field and historical snapshot formats.
Accounts, sessions, command results and account audit have separate typed tables.
Domain writes run in a PostgreSQL transaction with a shared advisory lock;
member-code and daily-attendance indexes enforce uniqueness. Repeated requests
with the same request ID return the original result. Browser data is memory-only;
PostgreSQL is the source of truth. The existing browser-only prototype is retained
in source but is not the active app.

The local database starts with approved reference catalogues and zero members.
It does not import browser storage or remote member data. It is independent of
the existing Supabase database; changes are not synchronized automatically.

## Vercel

Set these build environment variables in Vercel and redeploy:

```text
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_SUPABASE_USE_SAME_ORIGIN_PROXY=false
```

Local development defaults to `local`; production builds default to `supabase`.
For a local Supabase preview, set `VITE_DATA_BACKEND=supabase` explicitly.
Do not set `VITE_DATA_BACKEND=local` on Vercel: this database/API runs on this PC,
not in a static deployment. No service-role key or database password belongs in
a `VITE_` variable. The existing hosted app keeps Supabase Auth, enabled staff
checks, RLS and trusted functions. Local credentials do not create a hosted
account. Switching environment does not migrate local records to Supabase.

The existing `/supabase` Vercel rewrite is specific to the previously selected
project. Keep the same-origin proxy disabled when using another project, or
update the rewrite to match it. No deployment or remote database change was
performed as part of this local setup.

## Verification

`npm test`, `npm run lint`, `npm run build` cover the shared app.
`npm run test:local` creates an isolated temporary database, tests real API
authentication, permissions, CRUD, rollback, retries and persistence, then drops
only that generated test database. The main local database is retained.
