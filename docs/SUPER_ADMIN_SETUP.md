# Initial Super Admin from Vercel environment

The Vercel function can create the initial production Supabase Auth user and
link the existing unlinked Super Admin profile when you first log in with the
configured credentials. This is server-side provisioning, not browser env authentication.

## One-time database setup

Apply [the bootstrap migration](../supabase/migrations/20261005030000_super_admin_bootstrap.sql)
to the selected **TCF User's Database**, `snbfdktwrgzhwjqmyhdz`, using Supabase
SQL Editor or your migration pipeline. It installs one service-only RPC.
It does not import or reset member data, change browser grants or open RLS.
This migration has not been applied to the cloud project by this task.

## Vercel variables

Keep the two public cloud variables from [deployment setup](DEVELOPMENT.md).
Add the following to **Vercel Project → Settings → Environment Variables**,
scoped to **Production**:

| Variable | Value |
| --- | --- |
| `SUPER_ADMIN_EMAIL` | The email you want for the initial owner account |
| `SUPER_ADMIN_PASSWORD` | Your chosen password, 12–128 characters, also satisfying the project's password policy |
| `SUPABASE_SECRET_KEY` | This project's server secret key (`sb_secret_…`) or legacy `service_role` key |

The server key is available in the selected Supabase project's API Keys settings.
Mark password/server-key values sensitive where Vercel supports it. Never add
`VITE_` to these names: they are needed only in the Vercel function.
Do not put production credentials into the example file or commit them.
Preview deployments should use a separate database before enabling bootstrap.

Deploy the updated code/redeploy after setting the variables. Open the site's
normal login form and enter that exact email and password. The server will:

1. Try normal Supabase password authentication.
2. If authentication fails with invalid credentials, attempt to create a confirmed
   Auth user, then authenticate it. Duplicate creation is reconciled through
   authentication; existing passwords are never changed.
3. Atomically link the confirmed active identity to the prepared unlinked owner
   profile, or create the first owner profile if none exists. Record an audit event.
4. Return the normal Supabase session. All regular Auth/RLS/role checks remain active.

An existing owner linked to someone else, an existing Admin, disabled/deleted
staff, banned/unconfirmed users and multiple owner profiles block provisioning.
Review those cases explicitly; changing env values is not an account takeover,
password reset or access-revocation bypass.

## After first login

Remove the three bootstrap variables and redeploy once setup is confirmed.
Your account continues to log in through Supabase using the same credentials.
Keeping the variables is optional; it does not make env changes reset an existing
password. Use Supabase's password management for later password changes.

If a request times out or staff linking fails after Auth creation, retry with the
same credentials after correcting the migration/configuration. The Auth user may
already exist; the server never deletes an existing account to compensate.
The staff link and its audit entry are atomic and repeated linking is idempotent.

## Verification

`npm test` covers new/existing identities, wrong credentials, refresh isolation,
concurrent creation reconciliation, body size limits and redacted failures.
`npm run test:bootstrap` runs the SQL against a disposable local PostgreSQL database
and checks concurrent linking, browser-role denial and preserved account restrictions.
Real cloud provisioning/login must be verified after migration and deployment.
October 5 checks: 78 automated tests, the real PostgreSQL bootstrap test, lint
and production build passed. No bootstrap variable names or server module were
found in the generated browser bundle.

References: [Supabase server-side user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[password authentication](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
