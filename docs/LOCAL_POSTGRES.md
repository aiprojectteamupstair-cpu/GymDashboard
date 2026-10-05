# Local PostgreSQL workspace

Supabase is now the default dashboard backend. Use `npm run dev:local` for this
independent local database, or `npm run build:local` then `npm run preview:local`
for its built preview in `dist-local/`. See the current
[Supabase connection status](SUPABASE_RECONNECTION_2026_10_02.md).

The development app now uses its own PostgreSQL database and server-verified
email/password login. `npm run dev:local` starts the database and the Vite API together.
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

## Historical disconnection

Before the subsequent reconnection request, Supabase connections were removed.
That earlier change left remote databases and records intact. The current
Supabase connection is documented above; explicit local mode still uses only
`/api/local/` and this computer's PostgreSQL database.

Use `npm run build:local` followed by `npm run preview:local` to run a built local preview,
including its PostgreSQL API. A static Vercel deployment alone cannot access this
PC's database. Existing cloud deployments/settings were not changed or redeployed.

## Verification

`npm test`, `npm run lint`, `npm run build` cover the shared app.
`npm run test:local` creates an isolated temporary database, tests real API
authentication, permissions, CRUD, rollback, retries and persistence, then drops
only that generated test database. The main local database is retained.
