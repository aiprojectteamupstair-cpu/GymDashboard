# UI prototype

Updated: 2026-09-18. The user approved implementation on the existing eight-table
design and incremental upgrades after review.

## What is implemented

Dashboard, member directory/profile, reception check-in, new/edit member,
new/renew membership, attendance analytics and read-only package settings.
Layouts adapt to desktop and mobile screens. Forms use native modal dialogs,
labels, validation, error messages and keyboard dismissal.

Profiles have UUID identities and separate `TCF-0001` style readable codes.
Names, phones and voucher references can be shared. Renewal creates a new
membership with package/payment/category snapshots instead of replacing history.
Calendar calculations start from the original date and clip only the target month.
Calculated and overridden dates remain separate, with an override reason/activity.

Check-in requires identity confirmation. Repeated requests show the original time.
Archive/restore retains attendance and memberships. These behaviors demonstrate
proposals for review, not finalized live permissions or entry eligibility.

Excel export downloads four sheets: Read me, Members, Memberships and Attendance.
The workbook records its scope and Myanmar timezone, preserves IDs and phone
numbers as text, and exports dates as date cells. Full export includes archived
profiles/history. Period export includes the period's attendees and their full
membership context. Directory filters are not silently applied to the export;
the export dialog explicitly selects full data or an attendance period.

## Data and implementation boundary

`src/main.jsx` mounts `src/prototype/PrototypeApp.jsx`. Components call the local
operations in `repository.js`, separate from date/search rules in `domain.js`.
The repository returns the existing eight collections from `DATA_MODEL.md`.
A future async Supabase adapter will retain those business operations and add
loading/network handling, trusted database writes, authentication and RLS.

All sample people are fictional; example payment options are not the confirmed
gym catalogue. Unknown package durations remain null. Seed memberships for such
packages have explicitly marked sample manual end dates. `Ends today` is shown
separately while expiry-day entry rules are pending. Demo check-ins do not enforce
unconfirmed entry eligibility or access hours.

Changes persist only in this browser at `community-fitness:prototype:v1`.
Settings reset affects this prototype alone. No legacy workbook/browser data is
imported. Local roles and audit entries are demonstrations, not secure access
controls. Browser-local writes cannot guarantee simultaneous multi-device writes.
The original app files and local data remain separate.

## Verification

`npm test` exercises twelve cases covering calendar/leap years, timezone midnight,
stable IDs, renewal/override history, repeat check-ins, archive/restore, failed or
corrupt storage, period reconciliation and Excel text/date structure.

Browser verification covers member create/edit, renewal/override, duplicate
check-in, archive/restore, reload persistence, search/empty results, analytics
filter, Excel download, mobile navigation/dialogs and horizontal layout.
Lint and production build are the project checks. These prototype checks do not
replace future real database concurrency and permission tests.

## Next work

1. Review the working screens and settle required profile fields, expiry-day
   behavior, access hours, payment options and Reception/Admin permissions.
2. Select the Supabase project; implement reviewed migrations, Auth/RLS,
   trusted membership/check-in operations and an async repository adapter.
3. Reconcile legacy people to stable IDs, review uncertain dates/vouchers,
   then import reviewed records and reconcile attendance/export totals.

Changes to the eight-table design can use versioned migrations while preserving
IDs and history. New service tables for PT/Daypass can reference the same member
identity when their workflows are confirmed. No redesign is required to review
this prototype.

Related: [Brief](PROJECT_BRIEF.md), [Screens](SCREEN_FLOW.md), [Model](DATA_MODEL.md).
