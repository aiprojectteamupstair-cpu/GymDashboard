# Gym Active Member Dashboard

A browser-based dashboard for daily gym attendance. Attendance data appears
only after an administrator uploads a monthly Excel workbook. Uploaded data is
persisted in the current browser and supports member management, analytics,
Excel export, and role-based administrator access.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. On first run, use:

- Username: `admin`
- Password: `admin123`

Change the default password after signing in.

## Production build

```bash
npm run build
npm run preview
```

Application data and the signed-in session are stored in the current browser's
local storage. The project does not automatically import its reference workbook;
use the Upload Data page to add or replace a month.
