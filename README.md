# Home Stock Manager

Web app to manage family groceries, medicines, and household stock with low-stock shopping list generation.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- ORM: Prisma
- Local DB: PostgreSQL 17 in Docker with a persistent named volume
- Hosted DB: Neon PostgreSQL (free tier)
- CI/CD: GitHub Actions checks, followed by Render auto-deployment

## Features

- Shared inventory for family members.
- Role-based login: `ADMIN` and `FAMILY`.
- Add items, adjust stock (+/-), update thresholds, delete (admin only).
- Units support: count, gram, kilogram, milliliter, liter, tablet, strip, bottle, packet.
- Shopping list endpoint and UI: items where `quantity < threshold`.
- Medicine grouping by person: `ME`, `WIFE`, `BOTH`, `CHILD`, `FAMILY`.
- Seed dataset based on your grocery and medicine examples.
- Responsive household dashboard with inventory search, category filters, and a low-stock filter.
- Add essentials from the **Add item** dialog; items below **Minimum stock** appear in the shopping list.
- Stock row actions let you add, reduce, or change the minimum; deletion remains admin-only.

## Project Structure

- `packages/server`: Express API + Prisma schema + seed script
- `packages/client`: React frontend

### Server Architecture

- `src/controllers`: Request handling
- `src/services`: Business logic
- `src/repositories`: Data access
- `src/middlewares`: Auth middleware and role guards

## Local Setup

Prerequisites: Node.js 24 and Docker Desktop (running).

1. Install dependencies and generate the database client:

```bash
npm ci
npm run db:generate
```

2. Start Postgres, apply checked-in migrations, and optionally add demo data:

```bash
npm run db:start
npm run db:migrate
npm run db:seed
```

3. Start both API and web:

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

The local-only database defaults to
`postgresql://homestock:homestock@localhost:5432/home_stock`.
The Docker port is exposed only on your computer. Use `npm run db:stop` to stop Postgres;
its named volume retains your data. Do not remove the volume unless you intend to delete that data.

If you already have environment configuration, update `DATABASE_URL` from SQLite to Postgres
and remove or update any stale `DIRECT_URL`. Process environment variables override dotenv values.
The old SQLite file is preserved but is no longer used. Its data is **not automatically migrated**.
Do not delete it if you want to transfer existing inventory later.

### Using the linked Neon database locally

`neon deploy` pulls `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH` into
the gitignored root `.env.local` (or `.env` if it already exists). The API and Prisma
load these root files as well as server-local dotenv files; process environment variables
always win. Tests skip dotenv loading so a local Neon link cannot redirect CI or E2E tests.

The API keeps the existing `pg` connection pool through Prisma's `@prisma/adapter-pg`,
appropriate for a long-running Express server. Migrations use `DATABASE_URL_UNPOOLED`;
`DIRECT_URL` remains supported as an explicit override.

After linking, `npm run db:migrate` and `npm run dev` target the linked Neon branch.
Do **not** run demo seeding or E2E resets against that branch. To use Docker instead,
set `DATABASE_URL` and `DIRECT_URL` explicitly to the local Docker connection URL in
a dedicated terminal before running the migration and app commands.

### Networks that block PostgreSQL port 5432

Some office or guest networks allow HTTPS but block or interrupt direct PostgreSQL
connections (Prisma reports `P1001: Can't reach database server`, or `ECONNRESET`).
Add this line to the gitignored root `.env.local` to run the API against Neon over
WebSockets on port 443:

```dotenv
DATABASE_TRANSPORT=websocket
```

This uses Prisma's `@prisma/adapter-neon` and only works with Neon URLs. The default (`tcp`)
keeps the standard `pg` driver, which Render uses. Remove the line on networks that allow
port 5432. Re-check it after `neon env pull` or `neon deploy` rewrites `.env.local`.

Prisma **migrations still require port 5432** and cannot use this route. On a restricted
network, let the Render deployment apply them (its start command runs `prisma migrate deploy`),
or run `npm run db:migrate` from a network that permits PostgreSQL connections.

## Default Seed Logins

- Admin: `admin@homestock.local` / `Admin@1234`
- Family: `family@homestock.local` / `Family@1234`

Demo seeding adds missing records without resetting existing users, passwords, inventory, or events.
It is disabled when `NODE_ENV=production`. Never seed a hosted database with demo credentials.
For your own first administrator, use `npm run admin:create -w packages/server` with
`ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (at least 12 characters) set in the process environment.
It refuses to overwrite an existing account.

## API Endpoints (Core)

- `POST /auth/login`
- `POST /auth/register` (admin only)
- `GET /users/me`
- `GET /items`
- `POST /items`
- `PATCH /items/:id`
- `PATCH /items/:id/stock`
- `DELETE /items/:id` (admin only)
- `GET /shopping-list`
- `GET /medicines/grouped`

## CI/CD and Free Deployment

### GitHub Actions

[CI](.github/workflows/ci.yml) runs on pushes to `main` and pull requests:

1. Install locked dependencies with Node 24.
2. Generate Prisma Client and apply migrations to an isolated Postgres service.
3. Build, lint, and check formatting of changed files (excluding vendored Skills).
4. Run server/client unit tests and Chromium E2E tests.

Existing repository-wide formatting debt is not a deployment blocker; changed files must be formatted.
No Neon credentials or production secrets are needed in GitHub Actions.
For branch protection, require **Build, lint, and test** before merging into `main`.

### Initial provider setup

1. Create a [Neon Free](https://neon.com/pricing) project. Choose a region near your Render API.
   Copy the **pooled** connection URL for `DATABASE_URL` and the **direct/unpooled** URL for
   `DATABASE_URL_UNPOOLED`. Retain Neon's TLS connection parameters. These are secrets: enter them only
   in provider settings or your local process environment, never in Git or chat.
2. Push this configuration to GitHub. In Render, connect your GitHub account and choose
   **New > Blueprint**, select this repository and `main`, and use [render.yaml](render.yaml).
   The Blueprint creates a **Free Web Service** and a **free Static Site**, not a paid Render database.
3. Supply the following values. Replace example hostnames with the actual Render addresses
   assigned to your services; service names may need to be unique.

| Service  | Variable                | Value                                                                                |
| -------- | ----------------------- | ------------------------------------------------------------------------------------ |
| API      | `DATABASE_URL`          | Neon pooled PostgreSQL URL                                                           |
| API      | `DATABASE_URL_UNPOOLED` | Neon direct PostgreSQL URL, used by migrations                                       |
| API      | `CORS_ORIGIN`           | Exact frontend origin, e.g. `https://home-stock-web.onrender.com`, no trailing slash |
| API      | `JWT_SECRET`            | Automatically generated by the Blueprint; keep it stable between deploys             |
| Frontend | `VITE_API_URL`          | API origin, e.g. `https://home-stock-api.onrender.com`, no trailing slash            |

`NODE_ENV=production` is configured for the API, which rejects a missing/weak JWT secret,
missing database URL, or non-HTTPS frontend origin. Render supplies `PORT`.

4. Check the actual service URLs after creation. Correct `CORS_ORIGIN` and `VITE_API_URL` if
   Render assigned different hostnames. Changing `VITE_API_URL` requires a frontend rebuild.
5. On each service's **Settings > Auto-Deploy**, verify **After CI Checks Pass** is selected.
   Subsequent pushes to `main` deploy only after GitHub checks succeed. Initial provisioning
   and manual deployments can bypass that gate, so confirm CI before the first manual deploy.
6. Confirm `https://<api-host>/health` returns `{"ok":true}`. The API applies migrations
   with `prisma migrate deploy` before it starts; no schema resets or seeding run during deployment.
   Keep future migrations backward compatible while older instances may still be serving.

### Create your hosted administrator once

Free Render services do not provide an interactive shell. After the first successful API deployment,
run the admin command **locally**, pointing it at Neon, to create your own account. The frontend
does not have public registration. PowerShell example:

```powershell
$env:NODE_ENV = 'production'
$env:DATABASE_URL = Read-Host 'Neon connection URL' -MaskInput
$env:JWT_SECRET = Read-Host 'API JWT_SECRET from Render' -MaskInput
$env:CORS_ORIGIN = 'https://<your-frontend-host>'
$env:ADMIN_NAME = Read-Host 'Administrator name'
$env:ADMIN_EMAIL = Read-Host 'Administrator email'
$env:ADMIN_PASSWORD = Read-Host 'Administrator password (12+ characters)' -MaskInput
npm run admin:create -w packages/server
```

Use PowerShell 7 for `-MaskInput`. Run this in a dedicated terminal, then close it to discard
the environment variables. This command never seeds sample inventory or resets passwords.
Sign in on the hosted frontend, then add your own essentials.

### Free-tier behavior

- Render API services sleep after 15 minutes idle; the first request can take about a minute.
- SQLite is not used online: Neon persists your data independently of Render restarts.
- Neon Free has usage limits and scale-to-zero. Review current provider limits before relying on
  this for important data, and maintain backups.
- Both Render services receive free HTTPS `onrender.com` addresses. A purchased domain is optional.

### Database changes

For development schema changes, run `npm run prisma:migrate -w packages/server -- --name <change>`,
then `npm run db:generate` and commit the generated migration.
Do not use `prisma db push` or `migrate reset` against Neon. Deployments use committed migrations.

### Local E2E testing

E2E tests **reset their target database**. Use a separate disposable database and stop the normal
dev servers first (the tests start their own). For example, from PowerShell:

```powershell
docker compose exec db createdb -U homestock home_stock_test
$env:DATABASE_URL = 'postgresql://homestock:homestock@localhost:5432/home_stock_test'
$env:E2E_DATABASE_RESET = 'true'
npm run test:e2e
```

Run this in a dedicated terminal and close it afterwards. Never supply your personal or hosted
database URL. The reset command overrides `DIRECT_URL` with the explicit test URL to prevent a
separate migration URL from targeting another database.

## GitHub (Personal Repo)

Create repo `virudhagiri-e/home-stock-manager` and push:

```bash
git init
git add .
git commit -m "Initial full-stack home stock manager"
git branch -M main
git remote add origin https://github.com/virudhagiri-e/home-stock-manager.git
git push -u origin main
```

No secrets are committed. Keep real secrets only in environment variables.

## Quality Tooling

- Formatting: Prettier
- Linting: Oxlint
- Editor consistency: `.editorconfig`

Run checks:

```bash
npm run lint
npm run build
npm run format:check
```
