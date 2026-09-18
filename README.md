# The Community Fitness dashboard

Interactive React + Vite prototype for The Community Fitness By Strategy First Gym.
The current UI uses fictional members and browser-local storage. Supabase is the
planned shared database; no live project or real member import is connected yet.

## Run locally

```bash
npm install
npm run dev
```

Open the HTTP URL shown by Vite. Opening `index.html` directly as a `file://` URL
does not run the Vite application. No login is required in this UI prototype.

## Try the prototype

- Dashboard: today arrivals, active memberships, attendance trends and expiry follow-up.
- Members: search/filter, profiles, monthly attendance and membership history.
- Check-in: search, confirm the person and record one demo presence per Myanmar day.
- New/Renew: manual start date, calendar-month end date and explicit end override with a reason.
- Analytics: attendance periods, unique visitors, category breakdown and structured Excel export.
- Settings: review package rules and reset the fictional sample data.

The proposed archive/restore flow preserves membership and attendance history.
Payment method categories are recorded without amounts. Package durations and
access rules that are not confirmed are labelled accordingly.

## Checks and build

```bash
npm test
npm run lint
npm run build
npm run preview
```

Prototype data uses the isolated `community-fitness:prototype:v1` local storage
key. The original app remains in `src/App.jsx` and `src/exportWorkbook.js`; its
saved data is not automatically migrated or replaced. Local storage is for UI
review, not shared production data, authentication or database concurrency.

## Project context

- [Implemented prototype and next steps](docs/PROTOTYPE.md)
- [Confirmed requirements and proposed fields](docs/PROJECT_BRIEF.md)
- [Screen flow and proposed permissions](docs/SCREEN_FLOW.md)
- [Eight-table Supabase model](docs/DATA_MODEL.md)
- [Project recall and working rules](AGENTS.md)

Pending policies and fields in these documents do not become confirmed business
requirements merely because the prototype lets reviewers try them.
