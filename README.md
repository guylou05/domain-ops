# DomainScout AI

DomainScout AI is a domain-investment research and portfolio operations app. It combines deterministic domain generation and availability checks, explainable scoring, valuation records, watchlists, portfolio tracking, buyer research, outreach approvals, marketplace listing preparation, reports, notifications, integrations, settings, and admin controls.

## Current Architecture

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, responsive SaaS shell, and server-action workflows.
- **Auth and workspace context:** Auth.js credentials, JWT sessions, protected app routes, role-aware workspace access, and seeded demo users.
- **Application logic:** `src/lib/domain-engine.ts` provides deterministic availability, generation, scoring, and valuation logic for local development.
- **Database:** PostgreSQL via Prisma. The schema covers users, workspaces, RBAC, subscriptions, usage, domains, opportunities, scores, valuations, watchlists, portfolio records, buyers, outreach, jobs, reports, notifications, integrations, audit logs, AI usage, webhooks, and feature flags.
- **Operations:** Server actions support generator persistence, watchlist saves, portfolio acquisition/archive/renewal controls, report snapshots, buyer research generation, history checks, marketplace listing publication, notification read state, integration toggles, workspace settings, feature flags, and audit logging.
- **Background jobs:** `BackgroundJob` records, PostgreSQL worker leases, and Redis-coordinated recurring scheduling for scalable task execution.
- **Analysis service:** `services/api/main.py` remains available as a FastAPI companion service for future external scoring or AI workflows.

## Implemented Milestones

- [x] PostgreSQL-first Prisma schema with SaaS-ready entities.
- [x] Public landing, pricing, privacy, and terms pages.
- [x] Auth.js credential login, optional Google OAuth readiness, and registration/password-reset entry flows.
- [x] Protected dashboard routes and session-aware workspace context.
- [x] Domain generator with generated and manual/CSV persistence.
- [x] Opportunity list, detail view, scoring, valuation, and watchlist save actions.
- [x] Watchlist remove/acquire actions.
- [x] Portfolio views with auto-renew and archive controls.
- [x] Reports with generated portfolio snapshots.
- [x] Buyer research, history checks, and marketplace listing generation.
- [x] Outreach approval and notification read-state workflows.
- [x] Settings, integrations, feature flags, and audit-backed admin controls.
- [x] Server-rendered search, filter, and sort controls for opportunities, portfolio, and marketplace listings.
- [x] Background job queueing and worker execution for digest, buyer research, and portfolio snapshot tasks.
- [x] Availability provider adapter boundary with deterministic local mode and guarded live mode.
- [x] Playwright E2E smoke coverage plus opt-in seeded workflow coverage.
- [x] Initial Prisma migration and database deployment readiness checks.
- [x] GitHub Actions CI with Playwright browser install and seeded workflow E2E against migrated PostgreSQL.
- [x] Redis-backed recurring scheduling with UI-managed task cadence and distributed worker execution.
- [x] Seed script with demo users, workspace, opportunities, watchlists, portfolio, reports, notifications, integrations, and admin data.
- [x] Docker Compose for PostgreSQL, Redis, and the web app.
- [x] Unit tests for generation, scoring, and domain import parsing.

## Production Readiness Phase

This phase centralized audit event recording, added reusable admin role guards, expanded unit coverage around deterministic scoring and import parsing, removed outdated launch-era language from user-facing pages, and refreshed project documentation to match the implemented app.

## List Ergonomics Phase

This phase added shareable query-param controls for high-volume operating tables. Opportunities, portfolio holdings, and marketplace listings now support server-rendered search, filters, and sort modes without introducing client-side table state.

## Background Jobs Phase

This phase connected `BackgroundJob` records to executable worker task handlers. Admin users can queue supported workspace jobs, and `npm run worker` processes queued digest, buyer research refresh, and portfolio snapshot jobs.

## Provider Adapter Phase

This phase moved domain availability behind an explicit provider interface. Local and CI workflows use deterministic adapters, while live provider mode fails closed until credentials, rate limits, caching, and stale-data handling are configured.

## Auth Provider Phase

This phase added optional Google OAuth readiness beside credential login. Google sign-in is shown only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured, so local credential flows remain stable by default.

## E2E Readiness Phase

This phase added Playwright configuration, public/auth smoke coverage, and opt-in seeded workflow tests for generator persistence, watchlist acquisition, and admin job queueing. Workflow tests run only with `E2E_WORKFLOWS=1` and a migrated, seeded `DATABASE_URL`.

## Database Deployment Phase

This phase added the initial Prisma migration, production deploy/status scripts, and `npm run doctor:db` for schema and migration readiness checks. Use `npm run db:deploy` for production-style migration application.

## Worker Leasing Phase

This phase added database-backed leases to `BackgroundJob` processing. Worker processes now atomically claim queued jobs before execution, skip jobs already leased by another process, and clear lease metadata after completion or failure.

## CI Seeded E2E Phase

This phase added GitHub Actions checks for linting, typechecking, unit tests, production builds, Prisma validation, and seeded Playwright workflows against a migrated PostgreSQL service with Chromium installed in CI.

## Recurring Scheduling Phase

This phase added a persistent scheduler process that uses a Redis lock to coordinate recurring job creation across replicas and the existing PostgreSQL leases to process queued work. Runtime Settings controls scheduler enablement, polling frequency, and cadence for opportunity digests, buyer research refreshes, and portfolio snapshots.

## Remaining Hardening

- [ ] Implement live registrar, trademark, comparable-sales, and history adapters behind the provider interfaces.

## Local Setup

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

## Dependency Install Recovery

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

## Commands

- `npm run dev` - start Next.js locally.
- `npm run build` - production build.
- `npm run start` - serve production build.
- `npm run lint` - run ESLint.
- `npm run typecheck` - strict TypeScript check.
- `npm run test` - unit tests.
- `npm run test:e2e` - Playwright test entry point.
- `npm run test:e2e:list` - list Playwright tests without launching browsers.
- `npm run test:e2e:install` - install the Chromium browser used by Playwright.
- `npm run db:migrate` - Prisma migrations.
- `npm run db:deploy` - apply checked-in Prisma migrations.
- `npm run db:status` - inspect migration status against `DATABASE_URL`.
- `npm run db:validate` - validate Prisma schema syntax.
- `npm run db:seed` - seed demonstration data.
- `npm run worker` - process queued background jobs.
- `npm run worker -- --list` - list registered worker tasks without requiring a database connection.
- `npm run scheduler` - continuously schedule recurring jobs and process the queue using Redis coordination.
- `npm run scheduler -- --once` - run one scheduling and worker cycle for operational verification.
- `npm run docker:up` / `npm run docker:down` - local infrastructure.
- `npm run doctor:db` - validate schema and checked-in migration readiness.
- `npm run doctor:auth` - verify seeded demo users and demo password hashes.

The Settings page stores runtime-tunable app configuration in the database, including availability provider mode, worker limits, lease duration, recurring task cadence, scheduler polling, and auth diagnostic visibility. Bootstrapping secrets and infrastructure connection values such as `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` still belong in the deployment environment.

## Provider Integration Guide

Create provider adapters that return normalized records equivalent to `AvailabilityResult` from `src/lib/providers/availability.ts`. Live providers must include rate limiting, caching, stale-data labeling, structured errors, feature flags, and clear failure states. Provider mode is configured from Settings. Live mode intentionally fails closed until credentials and operational safeguards are configured.

## Deployment Notes

Deploy the Next.js app to Railway, Render, Fly.io, AWS, or a VPS with managed PostgreSQL and Redis. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `REDIS_URL`, and `ENCRYPTION_KEY`. Run `npm run doctor:db`, then `npm run db:deploy`, before routing production traffic. After the app is online, use Settings for runtime provider and worker configuration.

For Google OAuth, also set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The callback URL should be `${NEXTAUTH_URL}/api/auth/callback/google`.

## Railway GitHub Deployment

This repository includes `railway.json` and a production Dockerfile so Railway can deploy directly from GitHub. Railway will build the app, run `npm run railway:predeploy` to recover the first migration if needed and apply Prisma migrations, start the standalone Next.js server, and verify `/api/health` before marking the deploy healthy.

1. In Railway, create a project from the GitHub repository.
2. Add a PostgreSQL database service.
3. Add a Redis service, then add `DATABASE_URL` and `REDIS_URL` references to the web service.
4. Add required app variables:
   - `NEXTAUTH_SECRET` - strong random secret.
   - `NEXTAUTH_URL` - the generated Railway URL first, then your custom domain later.
   - `ENCRYPTION_KEY` - strong application secret.
   - `WORKER_ID=railway-web`.
5. Optional variables:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth.
6. Deploy from Railway. Watch the deployment logs for the Docker build, Prisma migration pre-deploy step, app boot, and `/api/health` check.

To run recurring jobs, add a second Railway service from the same GitHub repository. Set its Railway config file path to `/railway.scheduler.json`, reference the same `DATABASE_URL` and `REDIS_URL`, and set a distinct `WORKER_ID`, such as `railway-scheduler-1`. This service does not need public networking. Once it is running, enable recurring background jobs and set each cadence from the web app's Settings page.

Railway commonly injects `PORT=8080` for the running container. If you generate a public Railway service domain manually, use the port shown in the deploy logs, for example:

```text
Network: http://0.0.0.0:8080
```

In that case, set the Public Networking target port to `8080`.

To seed demo data after the first successful deploy, open a Railway shell for the web service and run:

```bash
npm run db:seed
```

## Troubleshooting

- If Prisma fails, confirm PostgreSQL is running and `DATABASE_URL` points to the expected database.
- If Railway reports a failed health check, open the deploy logs and confirm the service started on `$PORT` and `/api/health` returns JSON.
- If login fails locally, run `npm run db:seed` and use one of the demo users above.
- If the Docker web service cannot find dependencies, rebuild with `docker compose build --no-cache web`.
- If provider results look deterministic, confirm the workspace is still using development provider mode.
