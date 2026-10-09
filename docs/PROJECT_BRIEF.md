# The Community Fitness dashboard

> September 30: [approved member workbook imported](MEMBER_IMPORT_2026_09_30.md): 424 people, 485 memberships, 22 PT purchases; no attendance yet. Recorded Date is confirmed as Start Date, missing values remain unknown, source expiry/remarks are preserved. Guest IDs now use G001… with old aliases. Current packages remain only Gym and Swimming Pool Only. Local dummy data is retired with backup; frontend/Auth connection is still pending.

> September 29: Supabase schema-only phase completed on **The Community Fitness's Database** (`axbfwmrrxsgzevvqshdu`). Confirmed catalogue defaults only; no local/demo/real people or Excel data uploaded. Three months of historical Excel data will be reviewed and imported only after the system is final. Frontend/Auth integration is still pending. See [implementation and checks](../supabase/README.md).

Updated: 2026-09-23. The user's new concept replaces earlier category/package assumptions.

## Confirmed purpose

Reception records daily presence; admins manage people and memberships; the dashboard shows member information, monthly attendance and visual analysis, with structured Excel export. No checkout, money amounts, prices, balances or revenue. Payment is only a method/category. Supabase is the intended database; the current local UI has no live connection.

## Categories and IDs

| Category | Readable ID |
|---|---|
| VIP Customer | VC01, VC02, … |
| Customer | C001, C002, … |
| Student | S001, S002, … |
| Staff/Employee | E001, E002, … |
| Guest | G001, G002, … |

Internal identity is a stable UUID. Readable IDs change with category while former IDs remain searchable aliases. Names, contact numbers and vouchers are not unique identity keys. Category conversion preserves attendance and membership history.

## Package, plan and discount

These are three independent choices.

| Choice | Confirmed options |
|---|---|
| Package | Gym (All Classes, Swimming Pool, Sauna); Swimming Pool Only |
| Membership plan | 1 month; 3 months; 6 months; 1 Year |
| Discount | None; Condo 50%; Student 20%; Student 50% |

Admin can create packages and discounts (details are immutable after saving) and set Active/Inactive. Only active records appear in new selections. Changing a catalogue record does not rewrite purchased memberships.

Gym offers optional Personal Trainer (PT; Rehab is the same service):

| Purchased sessions | Validity |
|---|---|
| 5 | 1 calendar month |
| 10 | 1 calendar month |
| 20 | 2 calendar months |
| 50 | 5 calendar months |

The user confirmed that PT starts on the membership start date. Session-purchase validity is independent of the membership plan's duration or overridden membership end. Purchases remain separate records; session-by-session consumption is not requested yet. Swimming Pool Only has no training option.

## Guest trial and conversion

Guest means a one-day trial visitor. No package, plan or discount is selected for a Guest. The current implementation records the trial on the first check-in; same-day repeated check-ins return the original visit. A later trial day requires conversion to membership; no reissue workflow is defined.

To convert: edit the Guest, choose VIP/Customer/Student/Staff, then select package, plan and optional discount. Conversion, new readable ID, membership and optional training purchase save together. The original UUID, G-code alias and attendance history remain linked.

## Dates and history

Membership start is manual. End date adds the selected plan's calendar months from the original start, clamping only the target month's final day.

| Start | Months | Calculated end |
|---|---:|---|
| 2026-01-31 | 1 | 2026-02-28 |
| 2026-01-31 | 3 | 2026-04-30 |
| 2028-02-29 | 12 | 2029-02-28 |

Keep calculated and admin-overridden ends separately, with reason, actor and timestamp. Changing the start/plan in an unsaved form clears its previous override. Each renewal creates a new record. Historical imported expiry dates are preserved, never automatically recalculated.

Expiry-day entry eligibility is still pending; Ends today is displayed separately. No membership freeze or day-transfer workflow.

## Profile and analysis

Profile field proposal: name/category required; phone, birth date, student ID and remark optional. Age is derived only when a birth date is available. Required/optional rules still need business review.

Dashboard: today's check-ins, members with Active memberships, registered profiles including Guests, upcoming expiry follow-up. Analytics: completed 7/30/90-day periods, comparison with the preceding equal period, unique visitors, visits per visitor, repeat visitors, weekday averages, arrival hours and 14-day follow-up. Profile: monthly attendance calendar and membership/PT history. No absence or retention rate is inferred.

Archive/restore preserves history. Final deletion, attendance correction and backdated entry policies remain pending.

## Excel export

Five sheets: Read me, Members, Memberships, Attendance and Training. Export includes only essential readable member details, package/plan/discount, effective membership dates, payment method, attendance and PT validity. Internal UUIDs, former IDs, redundant snapshot columns and separate calculated/override dates remain stored but are not included in this operational report.

Full export includes archived profiles and histories. Attendance-period export includes attendees in that period and all their membership/training context. Directory filters are not silently applied. Text IDs/phones retain leading zeroes; dates are date cells; no amounts. Reporting export is not a database backup.

## Remaining decisions

- Required profile fields, payment categories, user/device counts and role permissions.
- Expiry-day entry, other membership eligibility and overlapping memberships.
- Archive/delete, attendance correction/backdating and possible Guest trial reissues.
- Whether session-by-session PT tracking is needed.
- Target Supabase project and reviewed legacy member mappings.

## Historical references

Earlier Jul/Aug/Sept labels represent three-month historical memberships. Staff off-peak and Student 06:00–16:00 / 06:00–21:00 were earlier access labels; Condo 50% is now a separate discount. Keep historical source notes rather than translating uncertain records into new products automatically. Classonly is no longer sold. Legacy Member No. may be a shared voucher and remains unconfirmed.

Source: user conversation, updated September 19 with PT 5-session validity and shared start date clarification.

- Membership workbook: `C:/Users/SFU/Downloads/Telegram Desktop/The_Community_Fitness_For_Active_Member_List_2026_5086e43d_8e5a.xlsx`.
- Attendance reference: `Daily-Active-Member-List.xlsx`.
- [Screens](SCREEN_FLOW.md), [Data model](DATA_MODEL.md), [Implementation](PROTOTYPE.md), [Recall](../AGENTS.md).

## September 21 refinements

Light/dark themes persist per browser. New member creation is located only in Members. Dashboard summary cards open searchable matching records and profiles. As requested on October 9, all member attendance calendars, including Staff/Employee, use normal calendar months from the 1st to the last day. Stored attendance is unchanged. See [Metric definitions](METRICS.md).
## September 22 UI and reporting (supersedes earlier reporting details)

- Product UI uses red, black, white and gray in light/dark modes; charts may use other distinguishing series colors.
- Dashboard order: KPI cards, charts, then a larger Today's check-ins panel with compact membership follow-up alongside.
- Export is available only in Analytics. Custom inclusive start/end dates replace the preset-only period; 1–366 days, no future dates. Today is allowed with a partial-day notice. Comparisons use the preceding equally sized period.
- Analytics attendance records have same-day time correction. The user confirmed this means editing stored check-in time, not a time filter. A reason is required; original timestamp plus before/after audit history are retained. Future times and stale edits are rejected. The attendance date, member, snapshots and presence count do not change. Backdated entry/date correction and live role permissions remain pending.
- Attendance Excel is a matrix: Member ID, Name, current Category, then one column per selected date; one row per selected member, numeric 1/0. 0 means no matching recorded check-in, not verified absence. Include zero-visit members. Category selection includes current category members plus people with matching historical category-at-visit records; matrix presence respects the historical visit filter. Other sheets keep these members' valid histories. Headers and the first three identity columns are frozen.
- Tests cover matrix totals, zero-visit members, month/leap-day boundaries, time validation, stale edits, original timestamp and audit preservation. Local role labels are not production authorization.

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
