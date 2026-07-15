# Authenticated Production Canary

## Purpose

The external canary signs in through the production Auth.js credentials flow, loads read-only dashboard routes, confirms the workspace role is `VIEWER`, signs out, and verifies the old session cannot reach a protected route. It runs every six hours and can be dispatched manually from GitHub Actions.

The canary never submits a workspace mutation. Its account has global and workspace `VIEWER` roles, no OAuth account, no MFA secret, and exactly one workspace membership.

## Ephemeral Credentials

No long-lived canary password is shared between GitHub and Railway. Each run requests a short-lived GitHub Actions OIDC token scoped to the `domainscout-production-canary` audience. Railway verifies the token signature, issuer, audience, repository, main-branch ref, workflow path, event type, and lifetime before generating a random one-run password.

The password is masked immediately, used for the credential login, and discarded when the job ends. Issuing a new password revokes existing canary sessions. Optional Railway variables are `CANARY_EMAIL` and `CANARY_WORKSPACE_SLUG`; the defaults are `production-canary@domainscout.invalid` and `demo-domain-portfolio`. If the email is changed, set the matching GitHub Actions variable `PRODUCTION_CANARY_EMAIL`.

Railway creates or rotates only an account named `DomainScout Production Canary`. It aborts rather than repurposing a normal user, linking an OAuth identity, or accepting membership in another workspace.

## Failure Handling

The workflow writes only route names, status outcomes, and durations. Passwords, email addresses, cookies, tokens, and response bodies are never logged. A failed run uploads the sanitized log for seven days and opens or updates one GitHub issue named `[Production canary] Authenticated workflow failing`. The next successful run closes that issue with a recovery timestamp.

For a break-glass operator verification, provision a temporary password from a private Railway task and use it only for that run:

```bash
CANARY_PASSWORD='<temporary-secret>' npm run canary:provision
CANARY_PASSWORD='<temporary-secret>' npm run canary:production
```

If an ephemeral credential is suspected of exposure, dispatch the workflow again to rotate it and revoke all prior canary sessions. Investigate the workflow run and GitHub identity-token access before closing the incident.
