# Product Roadmap

This file is the canonical development sequence for DomainScout AI. A phase is complete only when its schema changes, UI, authorization, tests, deployment notes, and CI checks are finished together. A model, placeholder screen, or provider interface alone does not complete a phase.

## Current Sequence

1. [x] Subscription Billing
   - Stripe Checkout and customer portal
   - UI-managed mode, currency, and encrypted credentials
   - Signed, replay-resistant, idempotent subscription webhooks
   - Subscription lifecycle state connected to existing entitlements
2. [x] Email Verification
   - Single-use verification tokens and transactional delivery
   - Verification status in account settings and administrative visibility
   - Protected high-risk workflows for unverified accounts
3. [x] Multi-Factor Authentication and Session Control
   - TOTP enrollment and recovery codes
   - Active-session visibility and revocation
   - Step-up authentication for billing, credentials, and team administration
4. [x] Operational Observability
   - Structured request, worker, scheduler, provider, and webhook telemetry
   - UI-visible operational health and failure history
   - Alert routing and retention controls
5. [x] Launch Hardening
   - Accessibility and responsive workflow audit
   - Performance budgets and query profiling
   - Backup/restore runbook, security review, and production smoke checks

## Post-Launch Sequence

6. [x] Distributed Abuse Protection
   - Redis-backed limits for credential auth, registration, recovery, and verification delivery
   - Privacy-safe counters, local fallback, and operational enforcement telemetry
   - UI-managed thresholds and seeded workflow coverage
7. [x] Supply Chain Maintenance
   - Automated dependency review and vulnerability policy
   - Controlled framework upgrade cadence and rollback evidence
8. [x] Authenticated Production Canaries
   - Least-privilege synthetic account and scheduled authenticated workflows
   - Alerted canary failures without production credential exposure
9. [x] Browser Injection Hardening
   - Per-request nonce-based Content Security Policy for rendered pages
   - Production removal of inline script and style execution allowances
   - Public and authenticated production regression checks

## Product Completion Sequence

10. [x] Deal Lifecycle and Renewal Intelligence
   - Editable portfolio holdings with dedicated detail, cost, valuation, listing, and activity views
   - Offers, negotiations, completed sales, fees, net profit, ROI, and holding-period workflows
   - Renewal calendar, carrying-cost analysis, keep/review/drop recommendations, decision history, and configurable reminders
   - Dashboard revenue, profit, sales, offers, sell-through, ROI, and renewal metrics sourced from persisted records
   - Exit gate: an end-to-end test covers opportunity to watchlist, acquisition, offer, sale, and renewal decision
11. [x] Discovery Operations and Data Mobility
   - Discovery jobs and saved searches with manual, daily, and weekly schedules, progress, cancellation, and history
   - Real CSV file upload with validation, duplicate handling, CSV-injection protection, review, and error reporting
   - Opportunity export, portfolio export, bulk selection, comparison, watchlisting, and approval actions
   - Source workflows for manual, generated, expired, auction, closeout, trend, and external-provider discoveries
   - Exit gate: seeded browser workflows cover scheduled discovery, bulk review, import, export, and workspace isolation
12. [x] Live Research and Registrar Integrations
   - Production registrar adapter for availability and pricing, plus documented contracts for additional registrars
   - Comparable-sales management with manual entry, CSV import, filtering, duplicate review, and provider synchronization
   - Production trademark, history, and approved public-business-data adapters with evidence, freshness, and legal-use controls
   - Provider caching, quotas, rate limits, stale-data labels, health telemetry, credential readiness, and failure isolation
   - Exit gate: contract tests cover every adapter and credentialed smoke checks prove each enabled live integration
13. [x] Outreach CRM and Approved Delivery
   - Buyer and contact create, edit, detail, notes, relevance, status, and activity-history workflows
   - Campaign creation, template library, personalized drafts, follow-up sequences, tasks, reminders, and bulk actions
   - Explicitly approved delivery through supported email adapters with contact history and delivery outcomes
   - Opt-out, do-not-contact, privacy, suppression, and audit enforcement
   - Exit gate: an end-to-end test covers buyer research through approved delivery, response, offer, and suppression
14. [ ] Marketplace Synchronization and Sale Landing Pages
   - Marketplace provider contracts, listing publication, synchronization, status reconciliation, and failure handling
   - Public domain-for-sale pages with buy-now, make-offer, contact, privacy, and fraud-protection workflows
   - Workspace-managed seller identity, logo, colors, pricing, contact details, and landing-page state
   - Inquiry and conversion analytics connected to buyer, offer, and sale records
   - Exit gate: provider contract tests and public browser tests cover listing sync, inquiry, and offer creation
15. [ ] AI Research Assistant
   - In-product assistant grounded in workspace opportunities, providers, comparable sales, buyers, portfolio, and renewals
   - Domain comparison, pricing rationale, risk explanation, buyer suggestions, outreach drafts, and renewal advice
   - Clear separation of verified facts, provider data, estimates, and model-generated opinions
   - UI-managed model configuration with prompt/output records, token usage, cost accounting, redaction, and retention
   - Exit gate: evaluations test grounding, workspace isolation, unsafe requests, cost controls, and approval boundaries
16. [ ] Public API and Developer Platform
   - Workspace-scoped API credentials with hashing, rotation, revocation, scopes, and last-used visibility
   - Versioned endpoints for opportunities, checks, watchlists, portfolio, buyers, reports, and asynchronous jobs
   - Pagination, filtering, sorting, idempotency, request IDs, rate limits, usage entitlements, and consistent errors
   - OpenAPI documentation, webhook subscriptions, signed delivery, retries, and developer examples
   - Exit gate: API contract, permission, quota, webhook, and backward-compatibility tests pass
17. [ ] Controlled Acquisition Automation
   - Research-only, manual-approval, and limited-automation modes with automatic purchasing disabled by default
   - Per-domain, daily, and monthly spend limits; score, buyer-count, TLD, trademark, and keyword policies
   - Duplicate prevention, cooldowns, premium-renewal safeguards, emergency kill switch, and complete audit trail
   - Registrar purchase adapters with mock, dry-run, approval, idempotency, reconciliation, and incident controls
   - Exit gate: destructive-path tests prove limits, approvals, kill switch, replay safety, and fail-closed behavior
18. [ ] Platform Administration and Billing Expansion
   - Platform-wide user, workspace, subscription, usage, provider-health, job, log, and AI-cost administration
   - Scoring weights, TLD rules, blocked keywords, trademark policies, templates, announcements, and system settings
   - Audited support impersonation, manual credits, invoice visibility, coupons, add-ons, and entitlement reconciliation
   - Separate platform-administrator authorization from workspace roles with mandatory step-up access
   - Exit gate: cross-workspace permission tests and administrative audit tests cover every privileged mutation
19. [ ] Experience and Acceptance Completion
   - Global search and command menu, light/dark themes, skeletons, empty states, and consistent feedback
   - Dedicated watchlist, buyer, portfolio, offer, sale, renewal, job, and administrative detail pages
   - Full dashboard chart set, responsive tables, keyboard workflows, accessibility audit, and mobile completion
   - At least 30 clearly labeled demonstration opportunities covering risks, buyers, holdings, renewals, offers, and sales
   - Exit gate: every original acceptance workflow passes in seeded CI and authenticated production canaries

## Phase Definition of Done

Every phase must include all applicable items below before its checkbox changes to complete:

- Forward-compatible Prisma migrations, realistic seed data, and rollback notes
- Complete UI states for loading, empty, success, validation, failure, responsive, and keyboard use
- Server-side workspace and role enforcement, audit events, rate limits, and encrypted credentials where applicable
- Unit, integration, permission, provider-contract, and seeded end-to-end coverage proportional to the risk
- Updated README, architecture, operations, security, provider, and deployment documentation
- Green lint, typecheck, tests, production build, performance budget, supply-chain checks, Railway deployment, smoke checks, and relevant production canaries

## Change Policy

The sequence changes only with explicit product-owner approval or when a newly discovered security, data-integrity, or deployment blocker must take priority. Record any change here before implementation. When the user asks for the "next phase," start the first unchecked phase in this file and complete its full exit gate before advancing.
