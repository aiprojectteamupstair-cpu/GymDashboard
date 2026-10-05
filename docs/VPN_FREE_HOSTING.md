# VPN-free dashboard hosting

October 5 cleanup: [development and production](DEVELOPMENT.md) is the current
setup. Local dev uses PostgreSQL; only production uses the relay.

Hosted workspace follow-up: the reported staff filter parse failure is addressed
by removing legacy route-capture query metadata before forwarding to PostgREST.
The rewrite capture now uses `__supabase_path` consistently. Deploy the updated
`vercel.json` and relay together. 81 tests, lint/build and an SDK workspace load
through simulated Vercel routing passed; real hosted acceptance remains pending.

The dashboard now sends Auth, member reads and trusted write requests to its own
website origin under `/supabase/`. The hosted server contacts the selected
`snbfdktwrgzhwjqmyhdz` project. A visitor's browser never needs a direct connection
to `*.supabase.co` for these workflows.

## Deployment

The repository has a Vercel Vite build configuration and a Web-standard Node
function in `api/supabase.js`. `/supabase/:path*` rewrites to that function. The
public project URL/key are supplied by Vercel Environment Variables; no privileged Supabase key is
needed by the regular relay. Optional [initial owner setup](SUPER_ADMIN_SETUP.md)
uses a server-only secret key in a separate bootstrap module imported by the
Vercel function; the regular relay never forwards it. Private environment files, local database, import folders
and workbooks are excluded by `.vercelignore`.

Deploy the existing repository to the user's Vercel account. This task found no
linked Vercel project, signed-in CLI or connected Vercel plugin. A plugin
installation/connection was suggested. No hosting deployment has occurred yet.
Do not report the network problem resolved until the deployed route is tested
from the user's current network.

## Local development

`npm run dev` starts the independent local PostgreSQL database and API, without
cloud requests. No relay-origin variable or deployed site is required.
`npm run build` / `npm run preview` tests the cloud production bundle locally;
preview executes the same relay handler on this PC, so its outbound Supabase
route must be reachable. Test Vercel connectivity on the deployed website.

## Boundaries

- The upstream is fixed to the selected project. Callers cannot supply a host.
- Only password/refresh Auth, user lookup, logout, health, the workspace's
  read-only tables and the two existing Edge Functions are forwarded.
- Direct table writes, arbitrary RPCs and Auth admin endpoints are denied.
- The caller's publishable key and JWT are forwarded. RLS and Edge Function
  live role checks remain authoritative. The relay has no service-role key.
- Cookies, Origin and forwarding headers are not relayed to Supabase. Edge
  requests are server-to-server; browser CORS does not require a new deployment
  origin in those Edge Functions. Responses do not expose upstream cookies.
- Requests are size-limited. Redirects are not followed. All responses, including
  tokens and errors, use private/no-store headers for browsers and CDNs.
- No password, JWT, request body or member payload is logged by relay code.
- Auth accounts and staff links are a separate setup step. The previously
  approved owner identity was still absent at the last database check.

## Verification

71 automated tests, lint and production build passed. Tests cover fixed targets,
headers, login payloads, refresh/logout, pagination totals, denied routes/methods,
oversized bodies, non-caching, redirects, upstream failures and local routing.
Synthetic browser tests verified same-origin login/command URLs, zero direct
Supabase requests and the expected setup error before hosting is connected.

After deployment, run:

```powershell
npm run check:supabase -- https://YOUR-DEPLOYED-DASHBOARD
```

This checks the dashboard's proxied Auth health endpoint with the publishable
key, verifies the selected project marker and JSON response, and sends no login
password. A dashboard URL argument is required. A 503, HTML page or deployment-login redirect is
not a successful connection. Then verify the real owner login, paginated reads
and authorized write workflows without VPN. No live login success is claimed.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js),
[Vercel rewrites](https://vercel.com/docs/routing/rewrites).
