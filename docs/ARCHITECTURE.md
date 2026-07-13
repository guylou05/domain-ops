# DomainScout AI Architecture

Phase 1 uses Next.js App Router for the web app, Prisma/PostgreSQL for normalized multi-tenant data, Redis-ready background job records, and a FastAPI analysis-service scaffold. Provider-dependent features use adapters and mock implementations first so registrar, trademark, comparable-sales, and history integrations can be added without changing UI components.

## Folder structure
- `src/app`: public, app, and admin routes.
- `src/components`: reusable SaaS shell and UI primitives.
- `src/lib`: domain generation, availability, scoring, valuation, and demo data services.
- `prisma`: schema and seed data.
- `services/api`: Python FastAPI scoring/analysis service.
- `docs`: architecture and integration documentation.
