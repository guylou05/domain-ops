# DomainScout AI

DomainScout AI is a production-oriented domain-investment research and portfolio-management platform scaffold. Phase 1 includes a working Next.js application shell, public pages, dashboard, domain generator, opportunities table, domain detail report, watchlist/portfolio/report/admin foundations, a normalized PostgreSQL Prisma model, deterministic mock availability/scoring services, seed data, Docker development, and a FastAPI analysis-service scaffold.

## Current architecture

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, React components prepared for shadcn/ui patterns, responsive SaaS shell, dark UI.
- **Application logic:** `src/lib/domain-engine.ts` contains provider-style mock availability, domain generation, explainable scoring, and valuation logic.
- **Database:** PostgreSQL via Prisma. The schema prepares multi-tenant workspaces, RBAC, subscriptions, usage, opportunities, scores, valuations, watchlists, portfolio records, buyers, outreach, jobs, audit logs, AI usage, webhooks, and feature flags.
- **Background jobs:** `BackgroundJob` records plus a worker entry point for Redis-backed execution.
- **Analysis service:** `services/api/main.py` is a FastAPI scaffold for scoring, AI workflows, and future Celery jobs.
- **Security/SaaS preparation:** Workspace IDs, roles, Auth.js tables, credential placeholders, feature flags, audit logs, and `.env.example` are included. Do not commit real secrets.

## Implementation checklist

### Phase 1 delivered in this scaffold

- [x] Repository architecture plan and folder structure.
- [x] PostgreSQL-first Prisma schema with SaaS-ready entities.
- [x] Public landing, pricing, auth placeholder, privacy, and terms pages.
- [x] Application shell with sidebar navigation.
- [x] Executive dashboard using generated service data.
- [x] Domain generator service and page.
- [x] Mock availability provider and explainable scoring engine.
- [x] Opportunity list and domain detail report.
- [x] Watchlists, portfolio, reports, and admin foundation pages.
- [x] Seed script with demonstration users, workspace, opportunities, watchlist, and jobs.
- [x] Docker Compose for PostgreSQL, Redis, and web app.
- [x] FastAPI analysis-service scaffold.
- [x] Unit test for generation/scoring.


### Latest Phase 1 workflow progress

The domain generator now includes server actions for generated and pasted/CSV-style domain input. These actions resolve the demo workspace context, run mock availability and scoring, then persist `Domain`, `DomainCheck`, `DomainOpportunity`, `DomainScore`, `ScoreFactor`, and `Valuation` records so the next UI pass can query database-backed opportunities instead of demo-only data.

### Remaining hardening before private production use

- [ ] Install dependencies and run initial Prisma migration against PostgreSQL.
- [ ] Wire Auth.js credentials and Google OAuth flows to the placeholder pages.
- [x] Persist generator/manual/CSV results through server actions.
- [ ] Add TanStack Table filters/sorting and CSV import UI.
- [ ] Implement Redis-backed job queue execution and progress streaming.
- [ ] Expand admin RBAC checks and route middleware.
- [ ] Add Playwright E2E coverage after auth is wired.
- [ ] Configure live registrar, trademark, comparable-sales, and history providers behind feature flags.

## Local setup

```bash
cp .env.example .env
npm install
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000.

Demo seed users use password `demo-password`:

- `admin@domainscout.demo`
- `investor@domainscout.demo`


## Dependency install recovery

If `npm install` or `npm install --package-lock-only` fails with `E403 Forbidden` for public packages, first verify whether the shell is forcing npm through an unauthorized proxy:

```bash
npm run doctor:registry
```

If the doctor reports proxy-related environment variables, clear them or replace them with an approved proxy, then retry installation:

```bash
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY npm_config_http_proxy npm_config_https_proxy
npm config set registry https://registry.npmjs.org/
npm cache verify
npm install
```

The project also includes a committed `.npmrc` that pins the public npm registry, disables noisy funding/audit prompts during local setup, and documents the proxy failure mode.

## Commands

- `npm run dev` — start Next.js locally.
- `npm run build` — production build.
- `npm run start` — serve production build.
- `npm run lint` — run Next lint.
- `npm run typecheck` — strict TypeScript check.
- `npm run test` — unit tests.
- `npm run test:e2e` — Playwright placeholder command.
- `npm run db:migrate` — Prisma migrations.
- `npm run db:seed` — seed demonstration data.
- `npm run worker` — run the background worker entry point.
- `npm run docker:up` / `npm run docker:down` — local infrastructure.

## Provider integration guide

Create a provider adapter that returns normalized records equivalent to `AvailabilityResult` from `src/lib/domain-engine.ts`. Live providers must include rate limiting, caching, stale-data labeling, structured errors, and feature flags. Development uses `DOMAIN_PROVIDER=mock`.

## Deployment notes

Deploy the Next.js app to Railway, Render, Fly.io, AWS, or a VPS with managed PostgreSQL and Redis. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `REDIS_URL`, and `ENCRYPTION_KEY`. Run Prisma migrations before routing production traffic.

## Troubleshooting

- If Prisma fails, confirm PostgreSQL is running and `DATABASE_URL` points to `domainscout`.
- If the Docker web service cannot find dependencies, rebuild with `docker compose build --no-cache web`.
- If provider results look deterministic, confirm you are still using the mock provider; live integrations are intentionally not claimed as implemented.
