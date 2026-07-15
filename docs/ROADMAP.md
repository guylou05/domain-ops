# Product Roadmap

This file defines the development order after the implemented milestones in `README.md`. A phase is complete only when its schema changes, UI, authorization, tests, deployment notes, and CI checks are finished together.

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

## Change Policy

The sequence changes only when a newly discovered security, data-integrity, or deployment blocker must take priority. Such a change should be recorded here before implementation.
