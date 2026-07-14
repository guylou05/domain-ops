# DomainScout AI

DomainScout AI is a domain-investment research and portfolio operations app. It combines deterministic domain generation and availability checks, explainable scoring, valuation records, watchlists, portfolio tracking, buyer research, outreach approvals, marketplace listing preparation, reports, notifications, integrations, settings, and admin controls.

## Current Architecture

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, responsive SaaS shell, and server-action workflows.
- **Auth and workspace context:** Auth.js credentials, JWT sessions, protected app routes, role-aware workspace access, and seeded demo users.
- **Application logic:** `src/lib/domain-engine.ts` provides deterministic availability, generation, scoring, and valuation logic for local development.
- **Database:** PostgreSQL via Prisma. The schema covers users, workspaces, RBAC, subscriptions, usage, domains, opportunities, scores, valuations, watchlists, portfolio records, buyers, outreach, jobs, reports, notifications, integrations, audit logs, AI usage, webhooks, and feature flags.
- **Operations:** Server actions support generator persistence, watchlist saves, portfolio acquisition/archive/renewal controls, report snapshots, buyer research generation, history checks, marketplace listing publication, notification read state, integration toggles, workspace settings, feature flags, and audit logging.
- **Background jobs:** `BackgroundJob` records plus a typed worker entry point for scheduled task execution.
- **Analysis service:** `services/api/main.py` remains available as a FastAPI companion service for future external scoring or AI workflows.

## Implemented Milestones

- [x] PostgreSQL-first Prisma schema with SaaS-ready entities.
- [x] Public landing, pricing, privacy, and terms pages.
- [x] Auth.js credential login and registration/password-reset entry flows.
- [x] Protected dashboard routes and session-aware workspace context.
- [x] Domain generator with generated and manual/CSV persistence.
- [x] Opportunity list, detail view, scoring, valuation, and watchlist save actions.
- [x] Watchlist remove/acquire actions.
- [x] Portfolio views with auto-renew and archive controls.
- [x] Reports with generated portfolio snapshots.
- [x] Buyer research, history checks, and marketplace listing generation.
- [x] Outreach approval and notification read-state workflows.
- [x] Settings, integrations, feature flags, and audit-backed admin controls.
- [x] Seed script with demo users, workspace, opportunities, watchlists, portfolio, reports, notifications, integrations, and admin data.
- [x] Docker Compose for PostgreSQL, Redis, and the web app.
- [x] Unit tests for generation, scoring, and domain import parsing.

## Production Readiness Phase

This phase centralized audit event recording, added reusable admin role guards, expanded unit coverage around deterministic scoring and import parsing, removed outdated launch-era language from user-facing pages, and refreshed project documentation to match the implemented app.

## Remaining Hardening

- [ ] Run Prisma migrations against the target PostgreSQL environment.
- [ ] Add OAuth providers if the product needs non-credential sign-in.
- [ ] Add richer table sorting/filtering for high-volume opportunity and portfolio views.
- [ ] Connect Redis-backed job execution to `BackgroundJob` processing.
- [ ] Add Playwright coverage for login, generator persistence, watchlist acquisition, and admin controls.
- [ ] Configure live registrar, trademark, comparable-sales, and history providers behind feature flags.
- [ ] Replace deterministic provider outputs with live adapters only after rate limits, caching, stale labels, and secrets are configured.

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
- `npm run db:migrate` - Prisma migrations.
- `npm run db:seed` - seed demonstration data.
- `npm run worker` - run the background worker entry point.
- `npm run docker:up` / `npm run docker:down` - local infrastructure.

## Provider Integration Guide

Create provider adapters that return normalized records equivalent to `AvailabilityResult` from `src/lib/domain-engine.ts`. Live providers must include rate limiting, caching, stale-data labeling, structured errors, feature flags, and clear failure states. Development uses deterministic provider outputs so local workflows remain repeatable.

## Deployment Notes

Deploy the Next.js app to Railway, Render, Fly.io, AWS, or a VPS with managed PostgreSQL and Redis. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `REDIS_URL`, and `ENCRYPTION_KEY`. Run Prisma migrations before routing production traffic.

## Troubleshooting

- If Prisma fails, confirm PostgreSQL is running and `DATABASE_URL` points to the expected database.
- If login fails locally, run `npm run db:seed` and use one of the demo users above.
- If the Docker web service cannot find dependencies, rebuild with `docker compose build --no-cache web`.
- If provider results look deterministic, confirm the workspace is still using development provider mode.
