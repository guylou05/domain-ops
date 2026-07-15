# DomainScout AI

DomainScout AI is a domain-investment research and portfolio operations app. It combines deterministic domain generation and availability checks, explainable scoring, valuation records, watchlists, portfolio tracking, buyer research, outreach approvals, marketplace listing preparation, reports, notifications, integrations, settings, and admin controls.

## Current Architecture

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, responsive SaaS shell, and server-action workflows.
- **Auth and workspace context:** Auth.js credentials, JWT sessions, protected app routes, atomic trial workspace provisioning, role-aware multi-workspace selection, expiring invitations, and seeded demo users.
- **Application logic:** `src/lib/domain-engine.ts` provides deterministic availability, generation, scoring, and valuation logic for local development.
- **Database:** PostgreSQL via Prisma. The schema covers users, workspaces, RBAC, subscriptions, usage, domains, opportunities, scores, valuations, watchlists, portfolio records, buyers, outreach, jobs, reports, notifications, integrations, audit logs, AI usage, webhooks, and feature flags.
- **Operations:** Server actions support generator persistence, watchlist saves, portfolio acquisition/archive/renewal controls, report snapshots, buyer research generation, history checks, marketplace listing publication, notification read state, integration toggles, workspace settings, feature flags, entitlement enforcement, and audit logging.
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
- [x] Live-ready registrar, trademark, comparable-sales, and domain-history adapters with due-diligence workflows.
- [x] Encrypted workspace provider credentials managed from the Integrations UI.
- [x] Monthly subscription entitlement enforcement with atomic usage reservations and visible quota state.
- [x] Workspace team administration with hashed invitation links, role changes, revocation, and member removal.
- [x] Self-service workspace registration with automatic sign-in and 14-day subscription provisioning.
- [x] Validated multi-workspace switching from the application sidebar.
- [x] One-time password recovery, UI-configured transactional email, and authenticated password changes.
- [x] Stripe subscription checkout, customer portal access, encrypted billing credentials, and signed webhook reconciliation.
- [x] Single-use email verification with self-service resend, administrative visibility, and high-risk action gates.
- [x] TOTP multi-factor authentication, one-use recovery codes, tracked session revocation, and time-limited step-up access.
- [x] Structured operational telemetry, source health, incident resolution, email alert routing, and retention controls.
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

## Research Provider Phase

This phase added normalized provider interfaces for registrar availability, trademark screening, comparable sales, and domain history. Live HTTP adapters include serialized rate limiting, request timeouts, response caching, stale fallback, structured errors, and readiness reporting. Opportunity details can run due diligence and persist all three research result types, while Runtime Settings controls provider modes and endpoint URLs.

## Credential Vault Phase

This phase made live provider keys manageable from Integrations. Credentials are encrypted with AES-256-GCM before persistence, bound to their workspace and provider, replaceable without exposing the saved value, removable by workspace admins, and covered by secret-free audit events. Deployment variables remain supported as a fallback.

## Entitlement Enforcement Phase

This phase connected subscriptions and plan entitlements to real workflows. Domain checks, buyer research, reports, and due diligence now reserve monthly usage in serializable PostgreSQL transactions, release failed reservations, adjust to actual output, and fail closed when a feature is disabled or its limit is exhausted. Settings and Analytics show current-period usage against plan limits.

## Team Administration Phase

This phase added owner and administrator controls for workspace membership. Invitations use hashed seven-day bearer tokens, can be revoked before acceptance, support existing and new accounts, and create memberships transactionally. Owners can manage administrator access, while self-removal and owner mutation are blocked. Authenticated workspace resolution now follows the signed-in user's memberships instead of requiring a deployment-specific demo slug.

## Trial Onboarding Phase

This phase made public registration operational for metered workflows. Production migrations now guarantee the Professional plan catalog, and signup atomically creates the account, owned workspace, 14-day trial subscription, and audit event before signing the user in. Workspace slugs include a stable email hash to avoid collisions, trial enforcement fails closed at expiration, and Settings displays expired trial state explicitly.

## Multi-Workspace Phase

This phase made multiple workspace memberships usable. The selected workspace is stored in an HTTP-only cookie, revalidated against the signed-in user's active memberships on every context resolution, and exposed through a compact sidebar switcher. Unauthorized or stale cookie values fall back to an accessible workspace, and successful switches create audit events in the destination workspace.

## Account Recovery Phase

This phase replaced the placeholder forgot-password flow with one-hour, single-use recovery tokens stored only as SHA-256 hashes. Resend-compatible delivery is enabled from Runtime Settings with its API key stored in the encrypted Integrations vault, while admins can trigger recovery delivery without seeing the bearer token. Signed-in users can change their password from Settings after verifying the current password, and all credential changes are audited.

## Subscription Billing Phase

This phase connected the existing plan, trial, and entitlement models to Stripe Checkout and the Stripe customer portal. Billing mode and currency are managed from Settings, Stripe credentials are encrypted in the Integrations vault, and signed webhook events update subscription access transactionally with replay protection and idempotency. The ordered post-billing plan is tracked in `docs/ROADMAP.md`.

## Email Verification Phase

This phase added 24-hour, single-use email verification tokens stored only as SHA-256 hashes, automatic registration delivery, and self-service resend from Settings. Verification status is visible to users and workspace administrators, trusted Google OAuth claims verify matching existing accounts, and unverified users are blocked from billing, provider credentials, runtime configuration, feature flags, and team administration. Existing accounts are backfilled as verified during migration to preserve deployed access; new accounts must prove email ownership. Transactional delivery uses the same UI-managed Resend-compatible configuration and encrypted credential vault as password recovery.

## Multi-Factor Authentication and Session Control Phase

This phase added interoperable TOTP enrollment with QR setup, encrypted authenticator secrets, and ten hashed one-use recovery codes. Password and Google sign-ins honor enabled MFA, Settings shows and revokes tracked JWT sessions, logout and credential changes invalidate session records, and protected routes reject revoked or expired sessions. Billing, provider credentials, runtime configuration, feature flags, and team administration require identity confirmation within a ten-minute step-up window.

## Operational Observability Phase

This phase added structured PostgreSQL-backed telemetry for requests, workers, scheduler cycles, research providers, and Stripe webhooks. The Operations page exposes source health, searchable event history, incident resolution, UI-managed email alert thresholds and cooldowns, and configurable retention with automatic scheduler pruning.

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

The Settings page stores runtime-tunable app configuration in the database, including research provider modes and endpoint URLs, subscription billing mode and currency, worker limits, lease duration, recurring task cadence, scheduler polling, and auth diagnostic visibility. Provider and Stripe credentials are encrypted through Integrations. Bootstrapping secrets and infrastructure connection values such as `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` still belong in the deployment environment.

## Provider Integration Guide

Provider mode and endpoint URLs are configured from Settings. API keys are saved from the Integrations credential vault and sent as bearer tokens. Live mode fails closed when either the endpoint or key is absent; readiness is visible on Integrations. `REGISTRAR_API_KEY`, `TRADEMARK_API_KEY`, `COMPARABLE_SALES_API_KEY`, and `DOMAIN_HISTORY_API_KEY` remain optional deployment-variable fallbacks.

Each endpoint receives `GET <configured-url>?domain=<domain>` and must return JSON:

- Registrar: `available`, `registrationPrice`, `renewalPrice`, optional `premium`, and optional `registrar`.
- Trademark: `riskLevel`, `matches`, and optional `disclaimer`.
- Comparable sales: `sales[]` containing `domain`, `price`, `saleDate`, and optional `tld`, `marketplace`, and `industry`.
- Domain history: `riskLevel`, `flags[]`, and `evidence[]`.

Valid risk levels are `LOW`, `MODERATE`, `HIGH`, and `PROHIBITED`. Deterministic and mock modes remain available for local, demo, and CI workflows.

## Deployment Notes

Deploy the Next.js app to Railway, Render, Fly.io, AWS, or a VPS with managed PostgreSQL and Redis. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `REDIS_URL`, and an `ENCRYPTION_KEY` of at least 32 characters. Run `npm run doctor:db`, then `npm run db:deploy`, before routing production traffic. After the app is online, use Settings for runtime provider and worker configuration.

Keep `ENCRYPTION_KEY` stable. Changing it makes previously stored provider credentials unreadable; after an intentional rotation, re-enter each provider key from Integrations.

For Google OAuth, also set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The callback URL should be `${NEXTAUTH_URL}/api/auth/callback/google`.

For live research providers, save keys from Integrations. Endpoint URLs and provider modes are managed from Settings. Railway API-key variables are optional fallbacks.

For Stripe billing, set Test or Live mode and currency in Settings, then save the Stripe secret key and webhook secret in Integrations. Configure Stripe to send `checkout.session.completed` and `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` events to `${NEXTAUTH_URL}/api/billing/stripe`. Deployment variables with the same secrets remain optional fallbacks.

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
