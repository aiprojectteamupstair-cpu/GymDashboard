# Monthly body measurements

Implemented October 28, 2026 for the member profile's Body measurements tab.

## User workflow

- Open Members, select a member, then Body measurements. The tab has a stable
  `/members/:id/measurements` URL; Overview keeps the original profile URL.
- Select the current or a previous month. Enter weight, fat mass and skeletal
  muscle in kilograms, with up to two decimal places. All three are required.
  Body fat percentage is calculated as `fat_mass_kg / weight_kg * 100`.
- One active record is allowed per member/month. Selecting a recorded month
  loads its values for editing. A history-row pencil opens that same month.
  Delete requires confirmation, removes the visible entry and permits re-entry.
- Four metric cards show the latest recorded values and the change from the
  previous recorded month. Percentage changes use percentage points, not a
  relative-percent calculation. Missing months have gaps, never zero/imputed
  measurements. Charts cover 6/12 calendar months ending at the latest record,
  or all recorded months. History is paginated in groups of 12.
- Admin and Staff have the same measurement authority. Archived members retain
  viewable/exportable history; restore the member before adding or editing.
  Deleting an erroneous archived-member entry remains permitted.

The figures describe recorded changes, not medical targets or assessments.

## Data and authorization

`public.body_measurements` stores a stable UUID, member UUID, first-of-month date,
three numeric kg measurements, database-generated percentage, timestamps,
actor IDs and a nullable deletion timestamp. Weight must be greater than zero
and at most 1,000 kg; the two masses must be nonnegative and cannot exceed weight.
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

## Excel

Analytics Export Excel now contains six sheets. The original five keep their
order and operational columns; Body measurements is appended with Member ID,
Name, Category, Month, Weight (kg), Fat mass (kg), Skeletal muscle (kg), Body fat (%).
One row represents one recorded member-month. Only existing records are included.

The selected date range includes every measurement month it touches, even when
the range starts mid-month. Measurement category filtering uses the member's
current category, independently of attendance category-at-visit. Deleted entries
and people without measurements are excluded; archived members with data remain.
Rows sort by month then member code. Month displays `MM/YYYY`; kg values show two
decimals and percentage cells contain `ROUND(fat / weight * 100,2)` formulas with
matching cached values. Headers, gray/white row stripes, filters and frozen
identity columns match the existing workbook. Empty measurement sheets contain
headers only, not sample records.

## Deployment

Approved project: **TCF User's Database**, `snbfdktwrgzhwjqmyhdz`.
Migration: `20261028083327_monthly_body_measurements`.
Command endpoint: `gym-commands` version 5, JWT verification enabled.

Cloud schema/endpoint are deployed and rollback-only acceptance passed.
Frontend and relay changes still require Vercel redeployment together, followed
by actual authenticated browser acceptance. The dev server at port 3000 uses
the independent local PostgreSQL workspace. See [verification](DEVELOPMENT.md#october-28-verification).
