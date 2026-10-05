# VPN-free dashboard hosting

The dashboard now sends Auth, member reads and trusted write requests to its own
website origin under `/supabase/`. The hosted server contacts the selected
`snbfdktwrgzhwjqmyhdz` project. A visitor's browser never needs a direct connection
to `*.supabase.co` for these workflows.

## Deployment

The repository has a Vercel Vite build configuration and a Web-standard Node
function in `api/supabase.js`. `/supabase/:path*` rewrites to that function. The
public project URL/key remain in `.env.supabase`; no privileged Supabase key is
needed by the relay. Private environment files, local database, import folders
and workbooks are excluded by `.vercelignore`.

Deploy the existing repository to the user's Vercel account. This task found no
linked Vercel project, signed-in CLI or connected Vercel plugin. A plugin
installation/connection was suggested. No hosting deployment has occurred yet.
Do not report the network problem resolved until the deployed route is tested
from the user's current network.

## Local development

Once the hosted URL is verified, set `SUPABASE_RELAY_ORIGIN` in the ignored
`.env.supabase.local` to that exact HTTPS origin, without a path. An example is
in `.env.supabase.local.example`. Vite dev and preview then forward `/supabase`
to the hosted website, which connects to Supabase remotely. Restart Vite after
changing this setting. The hosted site itself needs no relay-origin setting.

Without a relay origin the local app reports a setup error immediately. It does
not use this computer's failing outbound Supabase route. Local PostgreSQL remains
available through the explicit local commands and is not an automatic fallback.

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
password. Running without an argument uses the configured relay origin or the
local dashboard at port 3001. A 503, HTML page or deployment-login redirect is
not a successful connection. Then verify the real owner login, paginated reads
and authorized write workflows without VPN. No live login success is claimed.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js),
[Vercel rewrites](https://vercel.com/docs/routing/rewrites).
