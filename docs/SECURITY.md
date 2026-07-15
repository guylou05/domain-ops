# Security Review

Review date: 2026-07-15

## Scope And Trust Boundaries

The review covers browser-to-Next.js requests, Auth.js sessions, workspace authorization, PostgreSQL records, Redis scheduler locks, encrypted provider credentials, transactional email, research providers, Stripe webhooks, GitHub Actions, and Railway deployment configuration.

## Implemented Controls

- Authentication uses hashed passwords, optional Google OAuth, TOTP MFA, one-use recovery codes, revocable tracked sessions, and ten-minute step-up access for sensitive changes.
- Workspace data access resolves active membership server-side. Writer, administrator, owner, verified-email, and recent-step-up guards protect mutations according to risk.
- Password reset, email verification, and invitation bearer tokens are stored only as SHA-256 hashes, expire, and are single-use.
- Provider and Stripe credentials use AES-256-GCM encryption and are never returned to the UI after storage. The deployment encryption key remains outside the database.
- Stripe webhooks require a valid signature, workspace metadata, replay protection, and idempotent reconciliation.
- Background workers use database leases; scheduler replicas use a Redis lock; operational failures and audit mutations are persisted.
- Responses set CSP, frame denial, MIME sniffing prevention, restrictive browser permissions, referrer policy, and HSTS headers.
- CI enforces lint, type safety, unit tests, migrations, production builds, asset budgets, query profiles, and seeded browser workflows.
- Production health and public/auth boundaries are checked daily by a separate smoke workflow.
- Secret-backed production canaries authenticate as a single-workspace `VIEWER`, exercise read-only dashboard routes, revoke their session, and alert through a deduplicated GitHub issue.
- Credential callbacks, login preflight, registration, recovery, and verification delivery use privacy-safe fixed-window limits backed by Redis, with UI-managed thresholds and process-local fallback.
- Exact npm versions, SHA-512 lockfile integrity, digest-pinned containers, SHA-pinned Actions, expiring advisory exceptions, Dependabot review PRs, and CycloneDX SBOM artifacts protect the software supply chain.

## Review Findings

| Risk | Disposition |
| --- | --- |
| Cross-workspace record access | Server-side workspace context and scoped queries are the required boundary; seeded multi-workspace tests cover selection and viewer authorization. |
| Credential disclosure | Encrypted storage and secret-free audit/telemetry metadata are implemented. Operators must keep `ENCRYPTION_KEY` stable and access-controlled. |
| Forged or replayed billing events | Stripe signature verification, event persistence, and idempotent processing are implemented. |
| Browser injection and clickjacking | CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and output escaping are enabled. Inline styles/scripts remain permitted where required by Next.js. |
| Destructive administrative actions | Role checks, verified-email gates, step-up authentication, and audit events are implemented. Database restore remains an operator-only procedure. |
| Dependency and supply-chain drift | Exact direct versions, immutable image/action references, lockfile provenance checks, weekly advisory enforcement, and SBOM evidence are implemented. Major frameworks require dedicated upgrade and rollback evidence. |
| Authentication and email abuse | Redis-backed IP and account counters protect direct Auth.js callbacks and public actions; blocked requests emit privacy-safe operational events. |

## Accepted Residual Risks

- Content Security Policy allows inline script and style execution for the current Next.js runtime. A nonce-based policy is a future defense-in-depth improvement.
- Provider correctness and availability remain third-party dependencies. Timeouts, stale fallback, failure telemetry, quotas, and operator alerts reduce impact but cannot remove it.
- Production canary access depends on GitHub's OIDC issuer and signing-key availability. Railway restricts exchange claims to the canary workflow on `main`; sanitized diagnostics intentionally omit identity, ephemeral passwords, cookies, tokens, and response bodies.

## Incident Handling

Rotate exposed credentials immediately, revoke sessions when identity risk is suspected, preserve audit and OperationalEvent records, stop workers if job integrity is uncertain, and follow `docs/OPERATIONS.md` for database recovery. Document timeline, scope, containment, recovery, and corrective controls after every security incident.
