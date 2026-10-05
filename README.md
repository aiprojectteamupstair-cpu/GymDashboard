# The Community Fitness dashboard

React + Vite dashboard for The Community Fitness By Strategy First Gym.

## Local development

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. Development uses the independent local PostgreSQL
API with server-verified login and HttpOnly sessions. No internet connection or
cloud environment variables are required after dependencies are installed.
Persistent data and generated credentials are stored privately in `.local-db/`.
Never delete that directory to restart the app.

## Vercel production

`npm run build` builds the Supabase production app to `dist/`. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel Environment
Variables. The selected cloud project is TCF User's Database. Production uses
the site's `/supabase` function to reach the cloud database from Vercel.

The root environment files are `.env.example` (committed template) and
`.env.local` (ignored developer settings for local production builds).
Local and production accounts/data are independent.

See [development and deployment](docs/DEVELOPMENT.md) for configuration,
commands, production preview and connectivity verification. Deployment and real
production login remain to be verified; a passing build does not prove either.

The initial Super Admin can be provisioned using server-only Vercel environment
variables; see [owner setup](docs/SUPER_ADMIN_SETUP.md) for the required migration.

## Verification

```powershell
npm test
npm run test:local
npm run lint
npm run build
npm run build:local
```

## Project context

- [Requirements](docs/PROJECT_BRIEF.md)
- [Screen workflows](docs/SCREEN_FLOW.md)
- [Data model](docs/DATA_MODEL.md)
- [Local PostgreSQL](docs/LOCAL_POSTGRES.md)
- [Production hosting](docs/VPN_FREE_HOSTING.md)
- [Working instructions and history](AGENTS.md)
