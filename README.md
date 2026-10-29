# Home Stock Manager

Web app to manage family groceries, medicines, and household stock with low-stock shopping list generation.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- ORM: Prisma
- Local DB: SQLite (easy local setup)
- Production DB suggestion: Postgres (Neon/Supabase free tier)

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

1. Install dependencies:

```bash
npm install
```

2. Create database schema and seed data:

```bash
npm run prisma:push -w packages/server
npm run prisma:seed -w packages/server
```

3. Start both API and web:

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Default Seed Logins

- Admin: `admin@homestock.local` / `Admin@1234`
- Family: `family@homestock.local` / `Family@1234`

Change these credentials immediately for non-local usage.

Optional for custom config: copy `packages/server/.env.example` to `.env` and set values.

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

## Deployment Guidance (Free + Easy Migration)

### Recommended Path

- Host frontend on Vercel or Netlify (free tiers).
- Host backend on Render or Railway (free/dev tiers vary).
- Use Neon or Supabase Postgres free tier for database.

### Why this path

- Cheap/free to start.
- Prisma makes migration from SQLite to Postgres straightforward.
- Easy later move to your own server/domain using Docker + reverse proxy.

### Migration to your own server later

1. Change Prisma datasource from SQLite to Postgres connection string.
2. Run Prisma migrations on your server DB.
3. Deploy API as a Node process or container.
4. Point domain DNS to server and use HTTPS with Caddy/Nginx + Let's Encrypt.

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
