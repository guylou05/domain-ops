# DomainScout AI Architecture

DomainScout AI uses a Next.js App Router web app, Prisma/PostgreSQL persistence, Auth.js credential and optional Google OAuth sessions, invitation-backed workspace RBAC, server actions for workflow mutations, Redis-ready background job records, and a FastAPI companion service for future external analysis workflows.

## Folder Structure

- `src/app`: public, auth, protected workspace, and admin routes.
- `src/components`: reusable application shell and shared UI surfaces.
- `src/lib`: domain generation, provider adapters, scoring, valuation, Prisma access, and server-side view models.
- `src/lib/server`: workspace context, audit helpers, page data loaders, and workflow persistence utilities.
- `src/worker`: registered background task entry point.
- `prisma`: schema and seed data.
- `prisma/migrations`: checked-in SQL migrations for deployable PostgreSQL environments.
- `services/api`: Python FastAPI analysis service.
- `tests`: unit coverage for deterministic domain logic and workflow parsing.
- `e2e`: Playwright smoke tests and opt-in seeded workflow specs.
- `docs`: architecture and integration notes.

## Request Flow

1. Middleware protects workspace routes and sends unauthenticated users to `/login`.
2. Auth.js always enables credentials and enables Google OAuth only when both Google environment variables are present.
3. Registration provisions the user, owned workspace, trial subscription, and audit record in one serializable transaction, then signs in through the credential callback.
4. Server components resolve the selected workspace from an HTTP-only preference cookie that is validated against the authenticated user's active memberships, then load page-specific view models through `src/lib/server/*`.
5. List pages parse query parameters on the server and pass typed filters into page data loaders, keeping high-volume tables shareable and crawl-free without client-side state.
6. Server actions resolve `requireWorkspaceContext`, enforce writer/admin guards where needed, mutate workspace records, record audit events for operational changes, and revalidate affected routes.
7. Prisma persists normalized domain research, portfolio, buyer, outreach, report, notification, integration, and admin records.
8. Admin users can queue supported `BackgroundJob` records from the admin page.
9. The worker entry point processes queued jobs through registered task handlers and updates status, progress, attempts, and errors.
10. Workspace invitation links retain only SHA-256 token hashes, expire after seven days, and create or attach members in serializable transactions after password verification.

## Provider Strategy

Local development uses deterministic provider outputs for repeatable generation, availability, history, buyer research, and listing workflows. Availability checks flow through `src/lib/providers/availability.ts`, which supports deterministic/mock modes and fails closed for live mode until credentials and safeguards are configured. Live providers should sit behind feature flags and must provide rate limiting, caching, stale-data indicators, structured errors, and credential isolation.
