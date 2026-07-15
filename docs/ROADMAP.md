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
3. [ ] Multi-Factor Authentication and Session Control
   - TOTP enrollment and recovery codes
   - Active-session visibility and revocation
   - Step-up authentication for billing, credentials, and team administration
4. [ ] Operational Observability
   - Structured request, worker, scheduler, provider, and webhook telemetry
   - UI-visible operational health and failure history
   - Alert routing and retention controls
5. [ ] Launch Hardening
   - Accessibility and responsive workflow audit
   - Performance budgets and query profiling
   - Backup/restore runbook, security review, and production smoke checks

## Change Policy

The sequence changes only when a newly discovered security, data-integrity, or deployment blocker must take priority. Such a change should be recorded here before implementation.
