# DomainScout AI Architecture

DomainScout AI uses a Next.js App Router web app, Prisma/PostgreSQL persistence, Auth.js sessions, workspace-scoped RBAC, server actions for workflow mutations, Redis-ready background job records, and a FastAPI companion service for future external analysis workflows.

## Folder Structure

- `src/app`: public, auth, protected workspace, and admin routes.
- `src/components`: reusable application shell and shared UI surfaces.
- `src/lib`: domain generation, deterministic provider logic, scoring, valuation, Prisma access, and server-side view models.
- `src/lib/server`: workspace context, audit helpers, page data loaders, and workflow persistence utilities.
- `src/worker`: registered background task entry point.
- `prisma`: schema and seed data.
- `services/api`: Python FastAPI analysis service.
- `tests`: unit coverage for deterministic domain logic and workflow parsing.
- `docs`: architecture and integration notes.

## Request Flow

1. Middleware protects workspace routes and sends unauthenticated users to `/login`.
2. Server components load page-specific view models through `src/lib/server/*`.
3. List pages parse query parameters on the server and pass typed filters into page data loaders, keeping high-volume tables shareable and crawl-free without client-side state.
4. Server actions resolve `requireWorkspaceContext`, enforce writer/admin guards where needed, mutate workspace records, record audit events for operational changes, and revalidate affected routes.
5. Prisma persists normalized domain research, portfolio, buyer, outreach, report, notification, integration, and admin records.
6. The worker entry point advertises registered task types; queue execution can be attached to `BackgroundJob` records without changing the UI contracts.

## Provider Strategy

Local development uses deterministic provider outputs for repeatable generation, availability, history, buyer research, and listing workflows. Live providers should sit behind feature flags and must provide rate limiting, caching, stale-data indicators, structured errors, and credential isolation.
