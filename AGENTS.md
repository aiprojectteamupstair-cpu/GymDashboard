# Project context and working rules

Last updated: 2026-09-18. Business: The Community Fitness By Strategy First Gym.

## Read first

- `docs/PROJECT_BRIEF.md`: confirmed requirements, proposed profile fields, pending decisions.
- `docs/SCREEN_FLOW.md`: proposed screens and reception workflow.
- `docs/DATA_MODEL.md`: proposed Supabase model and implementation checks.
- `docs/PROTOTYPE.md`: implemented UI, demo limitations and next steps.
- These documents are planning drafts. Proposed fields, permissions, metrics, and edge-case policies are not user-confirmed merely because they appear here.
- Continue in Burmese when communicating with the user.

## Current stage

- Interactive UI prototype implementation is authorized and has begun. The requested webpage-start notification has been given.
- Dashboard, Members/Profile, Check-in, New/Renew forms, Analytics and structured Excel export use fictional sample data and the existing eight-table design.
- The intended database is Supabase. No target Supabase project has been selected or modified in this task.
- Active app: React 18 + Vite, `src/prototype/PrototypeApp.jsx`; `src/main.jsx` mounts it. Demo state uses the isolated `community-fitness:prototype:v1` local storage key.
- Original app is retained in `src/App.jsx` and `src/exportWorkbook.js`. Its member keys derive from names; its saved data is separate and has not been migrated.
- Prototype profiles use stable UUIDs and separate readable codes. Reconcile real legacy identities before connecting production data; do not merge people solely by name or legacy voucher number.
- Existing attendance spreadsheet: `Daily-Active-Member-List.xlsx`.
- User-supplied membership workbook is a reference for business information, not a required UI/export template. Source path is recorded in the brief.

## Confirmed requirements

- Reception searches for a member and records a daily check-in. Only presence matters; no checkout.
- Member information and admin CRUD, attendance visuals, and structured Excel export are the initial focus.
- Payment method is a category only. Do not add money amounts, prices, balances, or revenue features.
- Membership dates: manual start date, automatic calendar-month end date, admin override.
- No membership freeze or day-transfer workflow in the initial release. Keep legacy special entries in remarks.
- Gym membership and personal training are separately purchased services.
- Jul/Aug/Sept packages mean three-month memberships, even where historical workbook dates appear inconsistent.
- Off-peak refers to staff access during specified hours for a discount. Exact hours are pending.
- Student (6-4): 06:00-16:00; Student (6-9): 06:00-21:00.
- Condo package: 50% discount for residents of the gym's condominium. Do not infer a duration.
- Daypass: one-day free promotional access for selected people or a new guest accompanying a member.
- Classonly is no longer sold. Classes are currently sold to gym members; details are pending.
- Legacy `Member No.` is likely a voucher number and may be shared by staff. Meaning is still pending confirmation. It is not a reliable unique member ID.
- Profile fields, monthly reporting definitions, user count, devices, and exact permissions are pending.

## Implementation direction

- Use a stable internal member ID and separate member profiles, package definitions, membership history, and attendance.
- Treat one presence record per member per Myanmar calendar day as a proposed attendance rule. Enforce uniqueness in the database when this design is implemented.
- Calculate calendar months from the original start date, clamp to the target month's final day, and retain calculated and overridden end dates separately.
- End-date inclusivity remains an explicit pending business decision; do not silently choose it in production.
- Preserve imported expiry dates and source references. Do not automatically recalculate historical memberships using current package rules.
- Unknown package duration, payment method, or membership dates must remain unknown; do not invent values.
- Proposed deletion behavior is archive with history retained. Final CRUD behavior needs confirmation.
- Use Supabase Auth, role-aware RLS and explicit grants. Membership identity differs from administrator login identity.
- Keep privileged keys server-side. Never add credentials, source member PII, or raw member rows to these docs.
- Do not upload/import existing Excel data into a live database until the target project and reviewed member mappings are available.

## Checks

- `npm run lint` and `npm run build` are existing app checks; run when implementation changes warrant them.
- `npm test` covers prototype calendar dates, overrides, duplicate retries, Myanmar midnight, preserved history, storage failures and export reconciliation. Browser review covers member create/edit/archive/restore, renewal, check-in, reload, filters, mobile layout and Excel download.
- Live implementation still needs database concurrent check-ins and role allow/deny checks; browser-local demo behavior is not production authorization or concurrency protection.
- Documentation-only updates require link and diff checks, not an unrelated app rebuild.
