# Operational metric definitions

Confirmed scope: user requirements through September 23, 2026. Implementation:
`src/prototype/insights.js`, `Analytics.jsx`, `AttendanceCalendar.jsx`.
Sources are the local attendance, member and membership collections; fixture
people are fictional. These screens do not establish real gym performance.

## Dashboard: act today

Myanmar calendar date is the reporting day. Today's check-ins count valid
presence records. Registered members include all non-archived profiles, including
Guests. Active memberships count people whose current membership status is
Active; Ends today is separate while the eligibility policy remains pending.
Expiring soon includes started memberships ending today through today + 14 days.
New / Renew counts non-voided membership records saved today (Myanmar created-at date), regardless of membership start date. First valid purchase is New, subsequent purchases Renew. New writes snapshot transaction_kind; older rows infer it from earlier created-at records. Guest/profile-only creation is excluded. Multiple transactions by one person count separately; the drilldown explicitly labels its count as membership records. This is neither revenue nor a unique-person total.

Each card opens the matching records and a route to individual profiles.

## Analytics: understand recorded engagement

Period is a custom inclusive date range of 1–366 Myanmar days. The default is the previous 30 completed days; today is allowed with a partial-day warning.
Compare against the immediately preceding period of the same length. Category
filters use the category snapshot at the visit, not the current profile.
Voided rows are excluded; repeated person/day records count once.

| Metric | Definition | Useful decision |
|---|---|---|
| Recorded visits | Distinct person/day presences | Compare recorded demand |
| Unique visitors | Distinct people in period | Reach of attendance |
| Visits per visitor | Visits / unique visitors | Frequency among visitors |
| Repeat visitors | People with 2+ visit days / unique visitors | Within-period engagement |
| Weekday average | Visits for weekday / occurrences of weekday in period | Reception staffing patterns |
| Arrival hours | Check-ins grouped by Myanmar local hour | Arrival workload, not occupancy |

Empty denominators show a dash, not zero percent. Percentage changes use
(current - previous) / previous; a zero previous value shows explanatory text.
Weekday averages include zero-record days. Follow-up is explicitly independent
of the historical period/category filter and includes all current categories.

Guardrails: these are recorded-data measures, not proof of absence, churn or
membership retention. Missing check-ins/history can understate totals. No targets,
revenue, live occupancy or session consumption are inferred. Previous period
series are aligned by relative day, not weekday. No causal conclusion is implied.

## Profile calendar boundary

As requested on October 9, all categories, including Staff/Employee, use the 1st
through the final day of the selected calendar month. Profile calendars and their
editors share these bounds. Adjacent months do not overlap, and stored attendance
is unchanged. Existing category-at-visit filtering remains in place.

## Export contract

Read me documents scope and counts. Members has 8 essential columns,
Memberships 10, Training 6. Attendance uses three identity columns plus one column per selected date. Membership/PT dates are typed Excel dates; matrix column headings are ISO dates. Identifiers
are text, and headings are frozen/filterable. Full export retains archived
profiles and valid history. A period/category export includes members in the current selected category plus historical matching attendees, including zero-visit members, and their full membership/PT context. Matrix presence respects the historical category-at-visit filter; cells are numeric 1/0. 0 means no matching recorded check-in, not verified absence. No technical UUIDs or monetary
amounts are exported; source history remains in storage.
# September 30 attendance-status card

Green: distinct non-archived people whose current membership status is Active, excluding Ends today under the existing unresolved expiry-day policy. Yellow and red are subsets of green, not mutually exclusive partitions of the whole card. Yellow: 10 through 20 days since last valid recorded visit; red: greater than 20 days. Difference is measured between Myanmar calendar dates, not elapsed UTC hours. Future and voided visits are ignored. People with no visit are listed separately with unknown duration; do not infer absence from missing historical imports. Every circle opens the matching people, last visit, elapsed days and profile action.
