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

## Review Findings

| Risk | Disposition |
| --- | --- |
| Cross-workspace record access | Server-side workspace context and scoped queries are the required boundary; seeded multi-workspace tests cover selection and viewer authorization. |
| Credential disclosure | Encrypted storage and secret-free audit/telemetry metadata are implemented. Operators must keep `ENCRYPTION_KEY` stable and access-controlled. |
| Forged or replayed billing events | Stripe signature verification, event persistence, and idempotent processing are implemented. |
| Browser injection and clickjacking | CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and output escaping are enabled. Inline styles/scripts remain permitted where required by Next.js. |
| Destructive administrative actions | Role checks, verified-email gates, step-up authentication, and audit events are implemented. Database restore remains an operator-only procedure. |
| Dependency and supply-chain drift | `package-lock.json` pins installs and CI uses `npm ci`. Dependency update review and vulnerability scanning remain recurring maintenance. |

## Accepted Residual Risks

- Credential login, registration, and recovery do not yet have a shared distributed abuse limiter. Railway edge controls or an upstream WAF should rate-limit authentication endpoints before broad public acquisition campaigns.
- Content Security Policy allows inline script and style execution for the current Next.js runtime. A nonce-based policy is a future defense-in-depth improvement.
- Provider correctness and availability remain third-party dependencies. Timeouts, stale fallback, failure telemetry, quotas, and operator alerts reduce impact but cannot remove it.
- Daily smoke checks verify public and auth boundaries without production credentials. Authenticated production workflows are covered in seeded CI and should also be exercised manually after high-risk releases.

## Incident Handling

Rotate exposed credentials immediately, revoke sessions when identity risk is suspected, preserve audit and OperationalEvent records, stop workers if job integrity is uncertain, and follow `docs/OPERATIONS.md` for database recovery. Document timeline, scope, containment, recovery, and corrective controls after every security incident.
