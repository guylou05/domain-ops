# Live Research and Registrar Integrations

## Provider contracts

- Registrar checks return domain, availability, registration and renewal prices, premium status, registrar, check time, and stale status.
- The built-in production registrar contract is Name.com Core `domains:checkAvailability`. Store the registrar credential as `username:token`; an endpoint override is optional.
- Generic live trademark, comparable-sales, and history endpoints use bearer authentication and normalized JSON contracts enforced in `src/lib/providers`.
- Public-business research uses SEC EDGAR company ticker metadata. Live requests require a workspace contact email and acceptance of policy `sec-edgar-v1`.

Provider endpoints and modes are configured in Settings. Encrypted credentials and smoke checks are managed in Integrations. Development and canary environments may keep providers in deterministic or mock mode.

The generic registrar response must provide boolean `available`, numeric `registrationPrice` and `renewalPrice`, optional boolean `premium`, and optional string `registrar`. Additional registrar implementations must satisfy the same `AvailabilityProvider` interface and contract tests.

Official references: [Name.com Core API](https://docs.name.com/api/v1/reference/domains/get-pricing-for-domain) and [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).

## Governance

Every server-side provider call is workspace scoped. Fresh responses are persisted in `ProviderCache`; retryable failures may use entries inside the configured stale window and are labeled stale. `ProviderUsage` tracks requests, cache hits, failures, and the last request time per UTC day. Settings control fresh-cache minutes, stale hours, daily quota, and minimum request interval.

Due diligence uses failure isolation: one failed research source does not discard successful results from other providers. Operational events retain provider mode, outcome, duration, and correlation identifiers without secrets or response bodies.

## Comparable sales

The Research page supports manual records, filters, removal, provider synchronization, and reviewed CSV imports. CSV columns are `subject_domain`, `domain`, `price`, `sale_date`, `marketplace`, `industry`, and `evidence_url`. Rows are validated, duplicate checked within the workspace, protected from spreadsheet formulas, and restricted to subject domains owned by the active workspace.

## Deployment and rollback

Deploy migration `20260715200000_live_research_integrations` before starting the release. It assigns existing comparable sales to the earliest matching workspace and removes orphaned global rows. Rollback should disable live provider modes first. Preserve the new tables for evidence and audit retention; application rollback is compatible once live calls are disabled, but the old globally scoped comparable-sale uniqueness rule must not be restored.

## Live enablement checklist

1. Set the adapter mode and HTTPS endpoint in Settings.
2. Save the encrypted provider credential in Integrations.
3. Configure quota, cache, stale fallback, and request spacing.
4. For SEC data, set the contact email and accept the public-data policy in Research.
5. Run the provider smoke check in Integrations.
6. Review Operations for a successful provider event before enabling routine use.
