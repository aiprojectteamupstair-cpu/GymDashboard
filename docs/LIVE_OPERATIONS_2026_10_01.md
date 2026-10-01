# Live operations — October 1, 2026

This supersedes older read-only/local-only status notes. Network readiness remains blocked; deployment is not end-to-end acceptance.

## Connected operations

`LiveApp` now calls authenticated `gym-commands` for member create/edit, Guest conversion, archive/restore, new/renew membership with optional PT, check-in, same-date time correction, and catalogue create/edit/status. Admin deletion is added to `admin-accounts`, alongside existing create/list. Super Admin accounts cannot be removed through that endpoint; staff/audit history is preserved.

The Edge handler validates the caller with Auth and an enabled staff profile. A service-role-only, SECURITY INVOKER database command then validates the actor again and performs each mutation plus audit in one transaction. No direct browser writes or anonymous command execution are granted. Secrets stay server-side. Catalogue detail editing and Admin management require Super Admin. Check-in preserves the previously confirmed manual eligibility acknowledgement, Guest trial rule and unique member/day constraint; no new automatic expiry-day policy is introduced.

Retries of an unchanged form reuse a request UUID. The database rejects reuse with different actor/action/payload. Transactions serialize code allocation and stale checks using a short advisory lock. This is suitable for current reception volume; it is not a high-throughput design. No HTTP calls occur while that database lock is held. Member and catalogue edits require expected timestamps. Date correction is not exposed; time correction preserves the attendance date, original timestamp, reason and audit.

After success, the frontend requests fresh data. A committed save followed by failed refresh is reported as saved, not as a reason to create another record. Dialogs prevent a second submit while saving. Unknown save results retain retry identity in memory; keep the form open and retry unchanged values. Reloading after an uncertain response still requires checking for the record first.

## Attendance visibility and refresh

- Loaded member/attendance counts and observed date range are visible.
- Analytics defaults to the latest recorded month when history predates today. A member calendar opens the latest recorded period, retaining the staff 25-to-25 rule.
- History completeness is not inferred from the newest row. Dashboard and comparisons explicitly qualify missing history. Assumed arrival times remain excluded from arrival-hour metrics.
- Pagination uses exact response counts and actual returned page lengths, including a server cap below 500. Partial/count-changing reads fail explicitly instead of silently publishing a truncated snapshot.
- Periodic full reads are reduced from every minute to five minutes. Focus/manual refresh remains. Forced refresh waits for an old in-flight load and then starts a fresh one. Five-minute stale snapshot clearing still protects revoked access; this is not offline mode.
- Full table loading remains a scaling limitation; incremental reads/server aggregation are future work.

## Verification

56 Node tests, lint and build passed during this change (rerun after final edits). Rollback-only SQL checks cover allocation, retries, Guest conversion, calendar/PT dates, duplicate check-in and stale edits. Admin removal rollback checks prevent Super Admin removal. Existing production totals remain 423 members, 484 memberships and 4,349 attendance.

Isolated synthetic browser checks verify September history defaults, coverage count, check-in dialog, command dispatch, dialog close and refreshed attendance after success. No real test members or Auth accounts were committed. Real authenticated browser-to-Edge-to-database acceptance remains pending network reachability and a user session.

## Outstanding external prerequisite

The local machine reaches supabase.com but both resolved project API IPv4 routes time out before TCP/TLS completion. DNS resolves. No VPN/DNS/firewall settings, custom domain, external proxy or paid hosting were changed. A no-VPN route must be tested on another network or an approved hosting/domain path before promising VPN-free operation. Frontend-only hosting does not remove the browser's API network dependency. Current Edge CORS permits localhost/127.0.0.1:3000 only; a chosen production origin must be explicitly added.

Security advisor retains the existing leaked-password-protection warning. No password/account was reset and no user data was removed during this change.
