# Screens and workflows

> September 29: no UI/login flow changed. Database tables now exist in the selected Supabase project, but the frontend still uses local storage. Real Supabase login, account administration and transactional writes are the next stage; see [Supabase status](../supabase/README.md).

Updated: 2026-09-23. Implemented local UI; final production permissions remain pending.

## Navigation

| Screen | Purpose |
|---|---|
| Dashboard | Daily arrivals, attendance trend, category mix, membership follow-up |
| Members | Search/current or former ID, category/status filters, profile/history |
| Check-in | Find person, confirm identity, record daily presence |
| Analytics | Period totals, daily attendance, category-at-visit breakdown, export |
| Packages & Discounts | Create packages and discounts (no editing saved details); Active/Inactive; available plan list |

The former Settings information/reset page was replaced by Packages & Discounts.
Prototype/demo banners and repeated development copy have been removed.
Local data and unconnected Supabase status are documented in developer docs.

## Add or edit a person

New member -> category -> automatically allocated readable ID -> profile fields.
Non-Guests can add package/plan/discount and optional training in the same form.
Profile-only creation remains available. Guest selection hides membership fields.

Edit profile preserves identity. A category change previews a new readable ID;
the previous code remains searchable. Existing members cannot be changed back to
Guest through the current UI.

## Guest conversion

Guest profile -> Convert to member -> choose VIP/Customer/Student/Staff ->
package + plan + optional discount -> optional Gym PT -> save together.

Cancellation or failed validation leaves the original Guest intact. A successful
conversion preserves the original internal ID and visits and adds the G-code to
previous IDs. The new membership captures the new category/code.

## Add or renew package

Select a non-Guest person -> active package -> plan -> optional active discount ->
payment category -> manual start -> automatic calendar end -> optional admin end
override/reason -> optional Gym PT sessions -> save new history record.

PT starts on the membership start date. 5/10 sessions end one month later,
20 two months later, 50 five months later. Switching to Swimming Pool Only clears
the hidden training selection. Overlapping membership dates show an advisory.

## Daily check-in

Search by name, phone, current/former ID -> confirm person -> save.
Repeated check-in on the same Myanmar day shows the original timestamp.
Guests get a first-day trial without membership. Once the trial day has passed,
their check-in dialog directs reception to convert them to a member.

Membership status and access information are shown. Production expiry-day and
other eligibility policies remain pending. No checkout or backdated input.

## Catalogue management

Packages and Discounts are separate tabs with search and Active/Inactive filters.
Creation forms allow a name, facilities/training eligibility for packages or
percentage for discounts, and status. Deactivated records disappear from new
membership dropdowns but remain visible in catalogue management and old history.
Legacy package definitions are kept inactive for historical references.

## Modal behavior

All dialogs isolate the background with native modal interaction and body/root
scroll locking. The form/dialog scrolls independently. Close, Escape and save
restore scrolling and the prior page position. Desktop and mobile paths are tested.

## Earlier permissions proposal (superseded September 23)

| Action | Reception | Admin |
|---|---|---|
| Search/profile | Read | Read |
| Today's check-in | Record daily presence | Record daily presence |
| Member/Guest conversion and renewals | Pending | Manage |
| Catalogue and overrides | No (proposal) | Manage |
| Analytics/export | Pending | Yes (proposal) |
| Corrections/backdating | Pending | Pending |

Local controls do not implement production security. Supabase Auth/RLS and direct
API allow/deny tests are required when the target project is selected.

Related: [Brief](PROJECT_BRIEF.md), [Model](DATA_MODEL.md), [Implementation](PROTOTYPE.md).

## Reporting and appearance

New member is available only in Members. Dashboard cards open matching searchable records with profile links. Theme control in the header persists light/dark selection. Analytics shows completed-period engagement and arrival patterns rather than repeating daily operations; see [Metrics](METRICS.md).

Staff profile calendars run from the 25th to the following 25th, both inclusive. The shared boundary date is reported in both cycles without duplicating storage. Other categories retain ordinary monthly calendars. Admin cannot edit existing package/discount details; Super Admin can edit them while existing memberships retain snapshots.
## September 22 update

Custom Analytics date ranges, Analytics-only export, same-day saved check-in time corrections with reason/original time/audit, red-neutral UI, and date-column 1/0 attendance export are implemented. The selected date range includes its endpoints and may include today (partial-day notice). Matrix exports include zero-visit members; 0 means no matching recorded visit. Underlying attendance remains row-based and unique per member/day. Live authorization and date/backdated-entry policies are still pending. See [current requirements](PROJECT_BRIEF.md#september-22-ui-and-reporting-supersedes-earlier-reporting-details).

## September 23 — current access and UI (supersedes earlier restrictions)

- Local login UI/role flow was explicitly selected; Supabase is still unconnected.
  First use creates one Super Admin (no default credentials). Super Admin can
  create/delete Admin accounts and edit saved non-legacy packages/discounts.
  Both roles share all other current member, attendance, catalogue create/status,
  analytics and export actions. Historical catalogue definitions remain preserved.
- Accounts are separate from gym records at `community-fitness:local-accounts:v1`.
  Passwords use salted PBKDF2-SHA256 (210,000 iterations), not plaintext.
  Sessions are per-tab sessionStorage, expire after eight hours, and deleted
  accounts lose their session on the next check. Login is a local workflow,
  NOT a trusted authorization boundary; browser storage is user-editable.
  Clearing storage loses local accounts/data. There is no local password recovery.
  Do not use this as protection for real member data on shared devices.
- Catalogue editing checks the local Super Admin role and stale updated timestamp,
  logs before/after changes, and leaves existing membership/PT snapshots untouched.
  Membership creation and attendance/audit actor IDs identify the signed-in account.
  Deleted account audit history and member data are retained.
- Dashboard has five cards in one desktop row. New / Renew counts valid membership
  transactions **saved today in Myanmar time**, not membership start dates.
  First membership is New; subsequent memberships are Renew. Profile-only/Guest
  creation does not increment it. Two saved memberships for a person count twice.
  Drilldown shows type, person, package/plan and save time. Narrow screens scroll
  the same card row horizontally.
- Page headers use only an icon and heading (functional controls remain).
  Sidebar uses the supplied original PNG on a light gradient in both themes.
  Student ID input/detail appears only for Student; previously stored values
  are retained when changing category.
- Check-in confirmation offers an optional same-day Myanmar time; blank uses now.
  Invalid/future times are rejected. Existing presence is never overwritten by a
  repeated check-in. Manual entries retain recorded-at time and time-source.
- Saved check-in time correction is reached from an already-checked-in dialog
  or Member profile → Attendance history → Edit time. Reason, same-date constraint,
  original timestamp, stale-edit rejection and before/after audit are retained.
- Analytics no longer includes the reconnect list or attendance-record table.
  Charts, custom dates, metrics and Analytics-only Excel export remain.
