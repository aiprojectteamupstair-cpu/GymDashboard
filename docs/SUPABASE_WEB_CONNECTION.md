# Supabase webpage connection — 1 October 2026

Latest: [connected write operations and current verification limits](LIVE_OPERATIONS_2026_10_01.md) supersede earlier read-only sections below. API network reachability remains unresolved.

## Latest: attendance and Admin creation

Historical attendance is now live (4,349 records through September 16); see [import reconciliation](ATTENDANCE_IMPORT_2026_10_01.md). Current member count is 423 following explicitly authorized duplicate deletion.

The accounts placeholder is replaced by a Super Admin list/create form backed by deployed `admin-accounts` Edge Function. JWT and enabled Super Admin checks precede privileged operations. Auth creation is followed by atomic staff/audit provisioning; uncertain results do not trigger unsafe deletion. Passwords are not persisted in frontend storage. Admin deletion is not yet enabled. Member, attendance and catalogue records remain read-only in the live UI.

52 tests, lint and production build pass. Isolated synthetic browser verification passed six-character-password creation and refreshed account listing; it did not create a real account. Actual authenticated endpoint testing remains pending due local project-domain HTTPS timeouts. Project health is active, general Supabase web access works, but this does not establish the exact ISP/routing cause. No DNS, VPN, Auth account or network settings were reset. Custom domains or hosted routing need a user-approved deployment choice and reachability test.

Migration: `20261001040433_admin_provisioning_and_attendance_import.sql`. Browser write grants remain closed; privileged credentials stay inside the function. Security advisor still flags leaked-password protection disabled; settings were not changed.

## Focus refresh and restored navigation

Same-identity Auth events, focus and the periodic access check now refresh in the
background without clearing the current page, filters or dialogs. A memory-only
coordinator coalesces in-flight loads and throttles automatic attempts to 30s;
manual Refresh bypasses that throttle. Initial loads still show a loading screen.
Transient network errors retain the last verified snapshot for up to five minutes
with an explicit notice; failed authorization, sign-out or identity change clears
it. Stale responses cannot republish data after an identity change. No member
data is persisted to browser storage; exports still require a fresh authorized read.

Check-in, Packages & Discounts and Super Admin-only Admin accounts navigation are
restored. Check-in search and catalogue reads work; writes remain blocked pending
trusted APIs. The accounts page explicitly shows only the caller's RLS-visible
profile, not a complete staff list; create/delete remains unavailable. Local
account management is not substituted for real Auth.

Verification: 48 Node tests, lint and production build pass. Isolated-browser
synthetic responses verify all restored tabs, delayed refresh preserving catalogue
search, same-user focus/Auth events, transient-error notice, and revoked access
removing the workspace. This does not substitute for a real-user browser session.

## Staff link repaired — latest October 1 status

The reported missing-profile error was traced to an enabled owner staff row with
null `user_id`. The approved email now belongs to a different confirmed Auth UUID,
`de3a0edd-e14a-44fa-911d-14787508c0a2`. After verifying its exact email, confirmation,
non-deleted and non-banned status, the existing staff profile was relinked in one
transaction with a `staff.auth_relinked` audit event. No account/password reset,
role change, grant change or RLS change was made. The cause of the Auth identity
replacement was not independently established.

Rollback-only authenticated-role checks for the current UUID return one staff
profile, 424 members, 485 memberships and 22 PT purchases; direct inserts remain
denied. The former UUID sees zero staff and zero members. User should Retry or
sign out/in with the approved account. Actual browser rendering remains unverified.
This supersedes the earlier account-link status below.

## Owner account linked — latest status

The user created the approved Auth account. Its exact email, confirmed status,
non-deleted status and absence of an active ban were verified before linking it
to staff profile `e0de280c-5ac0-4921-9e94-d4f03f4efbf7`. That profile is now enabled
with role `super_admin`; a `staff.auth_linked` audit event records the change.
No password was read, reset or stored; no table grants or RLS policies changed.

Rollback-only SQL role tests using the owner's Auth UUID returned 424 members,
485 memberships, 22 PT records and exactly one own staff profile. Direct inserts
remain denied. Temporarily disabled staff and an unregistered authenticated
identity each saw zero members; all test changes were rolled back. These verify
database RLS, not an actual browser login or JWT issuance.

This machine's HTTPS Auth health request still timed out after 10 seconds.
Real browser login remains unverified until network access works. Account setup
is no longer the blocker. The security advisor now reports one Auth setting:
[leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
This setting was reported, not silently changed.

## Implemented

- Active entry is `src/main.jsx` → `src/supabase/LiveApp.jsx`.
- Official SDK pinned to 2.117.2. Only the project's publishable key is in the
  browser. No privileged keys, passwords or workbook records are bundled.
- Supabase email/password and email-link login replace local login on the active
  entry. Email-link sign-in does not create accounts. Local account storage is
  preserved but is not consulted for authorization.
- Verified Auth identity plus an enabled, non-deleted `app_staff` profile is
  required before loading data. Existing RLS/grants are unchanged.
- Paginated reads support Members, Dashboard, Profiles, Analytics and Excel
  export. Raw import provenance is excluded from browser queries. Real data is
  kept in memory, not copied into local member storage. Auth sessions use tab
  sessionStorage. Access is rechecked on focus, every minute and before export.
- Source expiry dates take precedence over calculated dates. Missing start dates
  remain Unknown. Historical imports are excluded from today's New/Renew count.
- Live writes are not implemented. Mutation buttons explain the read-only limit;
  no local writes or anonymous/service-role permission workaround is used.

## Earlier provisioning attempt (superseded by owner linking above)

The user supplied an owner email and authorized account creation. Auth requests
from Node and curl timed out, and a browser health request also timed out.
The Supabase plugin can reach the database, but this machine currently cannot
reach the project's HTTPS Auth endpoint. No verification email was confirmed
sent and no Auth account was created by these attempts.

A **disabled, unlinked** Super Admin staff profile was prepared:
`e0de280c-5ac0-4921-9e94-d4f03f4efbf7`. `user_id` is null and `enabled` is false.
This grants nobody access. It must be linked to the exact user-authorized Auth
identity after account creation, not to an arbitrary signed-in account.

## Original setup checklist (steps 2–3 now completed)

1. Restore access from this machine to the selected project's `supabase.co` HTTPS
   endpoint. No global network/security settings were changed by the agent.
2. Create/invite the approved owner using Supabase Authentication → Users (or the
   supported Auth API once reachable). Never insert fabricated Auth rows, bypass
   verification or ask for the owner's password in chat.
3. Verify the resulting Auth UUID belongs to the approved email. Link only that
   UUID to the prepared profile, then enable it. Record the provisioning audit.
4. Configure the Supabase Site URL and redirect allowlist to match the webpage.
   Local Vite is configured for port 3000; use one consistent hostname. The app's
   email-link request uses its current origin. A rejected redirect must be fixed
   in Supabase settings, not by exposing member tables anonymously.
5. Complete a real owner login, verify all imported totals, export and logout,
   then test unregistered/disabled staff denial. These end-to-end tests are still
   pending; no real session was available in this run.

## Verified

43 Node tests, lint and production build passed. All configured selected columns
were checked against the actual database. An isolated browser rendered the login
screen after restarting the verified gym Vite server (stale optimized dependencies
had caused 504s). The browser confirmed the Auth network timeout.

The SDK install's audit reports two existing transitive advisory packages,
`brace-expansion` and `nanoid`, unrelated to the Supabase dependency. They were
reported but not updated as part of this scoped connection change.

Imported business data remains unchanged: 424 members, 485 memberships, 22 PT
purchases and no attendance. RLS remains enabled; unauthenticated access remains
closed. The previous local UI implementation is retained in source, not used as
a fallback for live data.
