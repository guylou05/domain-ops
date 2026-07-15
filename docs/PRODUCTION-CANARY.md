# Authenticated Production Canary

## Purpose

The external canary signs in through the production Auth.js credentials flow, loads read-only dashboard routes, confirms the workspace role is `VIEWER`, signs out, and verifies the old session cannot reach a protected route. It runs every six hours and can be dispatched manually from GitHub Actions.

The canary never submits a workspace mutation. Its account has global and workspace `VIEWER` roles, no OAuth account, no MFA secret, and exactly one workspace membership.

## Secret Configuration

Generate one random password of at least 24 characters and store the same value in both locations:

- Railway web service variable: `CANARY_PASSWORD`
- GitHub Actions repository secret: `PRODUCTION_CANARY_PASSWORD`

Optional Railway variables are `CANARY_EMAIL` and `CANARY_WORKSPACE_SLUG`. The defaults are `production-canary@domainscout.invalid` and `demo-domain-portfolio`. If the email is changed, set the matching GitHub Actions variable `PRODUCTION_CANARY_EMAIL`.

Railway predeploy creates or rotates only an account named `DomainScout Production Canary`. It aborts rather than repurposing a normal user, linking an OAuth identity, or accepting membership in another workspace. Existing canary sessions are revoked whenever the credential rotates.

## Failure Handling

The workflow writes only route names, status outcomes, and durations. Passwords, email addresses, cookies, tokens, and response bodies are never logged. A failed run uploads the sanitized log for seven days and opens or updates one GitHub issue named `[Production canary] Authenticated workflow failing`. The next successful run closes that issue with a recovery timestamp.

Run an operator verification after credential rotation:

```bash
CANARY_PASSWORD='<secret>' npm run canary:production
```

Rotate the password after suspected exposure, revoke the GitHub secret and Railway variable first, redeploy to update the account hash, then replace the GitHub secret and dispatch the workflow.
