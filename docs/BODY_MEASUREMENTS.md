# Monthly body measurements

Implemented October 28, 2026 for the member profile's Body measurements tab.
Updated the same day to pounds and the refined measurement dashboard.

## User workflow

- Open Members, select a member, then Body measurements. The tab has a stable
  `/members/:id/measurements` URL; Overview keeps the original profile URL.
- Select the current or a previous month. Enter weight, fat mass and skeletal
  muscle in pounds (lb), with up to two decimal places. All three are required.
  Body fat percentage is calculated as `fat mass / weight * 100`.
- One active record is allowed per member/month. Selecting a recorded month
  loads its values for editing. A history-row pencil opens that same month.
  Delete requires confirmation, removes the visible entry and permits re-entry.
- Four selectable metric cards show the latest values, mini trends and changes
  against either the previous or first recorded month. The selected metric has
  a larger chart with first/latest/period-change summaries. Percentage changes
  use percentage points, not relative percent. Missing months have gaps, never
  zero/imputed values. Charts cover 6/12 calendar months ending at the latest
  record, or all recorded months. History is paginated in groups of 12.
- Desktop places the focused chart beside a compact monthly entry panel; mobile
  puts entry before the chart. Edit/delete controls stay accessible at the right
  of the horizontally scrollable history table. Colors identify metrics, not
  medical judgments about a change being good or bad.
- Admin and Staff have the same measurement authority. Archived members retain
  viewable/exportable history; restore the member before adding or editing.
  Deleting an erroneous archived-member entry remains permitted.

The figures describe recorded changes, not medical targets or assessments.

## Data and authorization

`public.body_measurements` stores a stable UUID, member UUID, first-of-month date,
three canonical numeric kg measurements, database-generated percentage, timestamps,
actor IDs and a nullable deletion timestamp. Weight must be greater than zero
and at most 1,000 kg; the two masses must be nonnegative and cannot exceed weight.
New lb input is limited to 2,204.62 lb, preserving the existing storage limit.
The month cannot be in the future. An edit cannot move an existing row to another
month; delete/re-enter an incorrectly assigned month.

A partial unique index enforces one nondeleted row per member/month. Read RLS
allows only enabled, nondeleted Admin/Staff and excludes deleted measurements.
Browser writes and direct RPC calls remain denied. `gym-commands` verifies the
Auth caller, then invokes service-only `gym_body_measurement`. The RPC rechecks
the staff account, locks records, rejects stale `expected_updated_at` values,
and audits before/after values. A matching request ID safely replays its original
result; changed payloads or another actor cannot reuse it. The percentage sent
by a client is ignored. No health data or credentials are public assets.

Deletion is logical, not physical: the original values and audit remain.
No member merging, account changes, attendance or membership changes occur.
The separate local PostgreSQL backend follows the same validation and operation
rules, with its own measurement collection and partial unique index. Local and
Supabase records are not synchronized automatically.

### Unit conversion and compatibility

The exact factor is `1 lb = 0.45359237 kg`, from
[NIST's conversion tables](https://www.nist.gov/document/2026-nist-handbook-44-appendix-c).
The existing `*_kg` columns are widened from numeric(6,2) to numeric(14,10), so
two-decimal lb values retain exact canonical precision. The generated percentage
is recreated with the same formula. Existing values/timestamps and audits are
not reinterpreted or changed. An isolated migration test verifies a populated
legacy row survives unchanged.

The new UI sends `measurement_unit: 'lb'` and `weight_lb`, `fat_mass_lb`,
`skeletal_muscle_lb`. Omitted units retain the legacy kg request contract; mixed
unit fields and unsupported units are rejected. Local and Supabase commands do
the conversion, not a rounded two-decimal kg payload from the browser. On edit,
an lb input matching the rounded display of the existing value preserves that
field's exact stored kg value, avoiding drift in untouched fields.

## Excel

Analytics Export Excel now contains six sheets. The original five keep their
order and operational columns; Body measurements is appended with Member ID,
Name, Category, Month, Weight (lb), Fat mass (lb), Skeletal muscle (lb), Body fat (%).
One row represents one recorded member-month. Only existing records are included.

The selected date range includes every measurement month it touches, even when
the range starts mid-month. Measurement category filtering uses the member's
current category, independently of attendance category-at-visit. Deleted entries
and people without measurements are excluded; archived members with data remain.
Rows sort by month then member code. Month displays `MM/YYYY`; lb values show two
decimals and percentage cells contain `ROUND(fat / weight * 100,2)` formulas with
matching cached values. Converted cells retain their underlying precision, so
display rounding does not alter the percentage calculation. Headers, gray/white row stripes, filters and frozen
identity columns match the existing workbook. Empty measurement sheets contain
headers only, not sample records.

## Deployment

Approved project: **TCF User's Database**, `snbfdktwrgzhwjqmyhdz`.
Migrations: `20261028083327_monthly_body_measurements` and
`20261028104605_measurement_pounds_precision`.
Command endpoint: `gym-commands` version 5, JWT verification enabled.

Cloud schema/endpoint are deployed and rollback-only acceptance passed, including
lb round trips and preservation of legacy kg fields. No Edge redeployment was
needed for lb payloads; the existing command endpoint forwards them to the RPC.
Frontend and relay changes still require Vercel redeployment together, followed
by actual authenticated browser acceptance. The dev server at port 3000 uses
the independent local PostgreSQL workspace. See [verification](DEVELOPMENT.md#october-28-verification).
