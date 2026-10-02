# Direct API reachability check, October 2

Requested endpoint: `https://snbfdktwrgzhwjqmyhdz.supabase.co/rest/v1/`.
This is a connectivity test, not approval to replace the application's existing
`axbfwmrrxsgzevvqshdu` project or move its data/credentials.

## Observed on this computer

- Ethernet is up with the default route through `192.168.0.1`.
- Both visible TAP VPN adapters, including Outline, are disconnected.
- Direct curl uses `--noproxy '*'`; no API key or Authorization header was sent.
- System DNS and Google's DNS-over-HTTPS both return `172.64.149.246` and
  `104.18.38.10` for the requested hostname.
- TCP port 443 timed out on both addresses in the Node diagnostic (8 seconds).
- Direct HTTPS timed out in curl (10 seconds); explicitly testing the second
  address with the original TLS hostname also timed out (8 seconds).
- Node HTTPS reached its 12-second deadline without receiving an HTTP response.
- The control `https://supabase.com` returned HTTP 200 using curl.

The expected HTTP 401 JSON message `No API key found in request` was **not**
received. DNS resolved consistently, but this route did not establish TCP to
the project gateway. This suggests a network-path/filtering problem; it does
not identify whether the ISP, router, local firewall, or an upstream route is
responsible. Marketing-site access does not establish project API reachability.
No VPN, DNS, hosts file, firewall or routing settings were changed.

## Project fixes

- The diagnostic now accepts the exact requested URL as a positional argument,
  checks REST without credentials, reports DNS/TCP/HTTP separately and returns
  nonzero unless the expected no-key response is actually observed.
- It uses Node's environment-file parser, handles DNS failures and no longer
  prints proxy environment values (which can contain credentials).
- Vite now provides the missing `/supabase` proxy when Supabase mode and the
  same-origin-proxy option are explicitly selected. Upstream comes from
  `VITE_SUPABASE_URL`; TLS verification remains enabled.
- A production build with proxy mode now rejects a mismatch between that URL
  and the static Vercel rewrite, instead of silently routing to another project.
- Local PostgreSQL remains the default development backend. The currently
  configured project and its Vercel rewrite were not switched to the test host.

A local reverse proxy uses this same computer's outbound network; it cannot
repair the observed upstream TCP timeout. A hosted proxy/custom domain would
need a separately reachable route and verification after deployment. No new
proxy was deployed and VPN-free Supabase access is not confirmed.

## Repeat

```powershell
npm run dev:check-supabase-network -- https://snbfdktwrgzhwjqmyhdz.supabase.co/rest/v1/
```

59 regression tests, lint and production build passed. The negative real-network
test is a separate result from those passing code checks.

Reference: [Supabase DNS troubleshooting](https://supabase.com/docs/guides/troubleshooting/nxdomain-error-connecting-to-a-supabase-project).
