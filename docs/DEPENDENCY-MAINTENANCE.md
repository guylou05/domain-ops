# Dependency Maintenance Policy

## Enforced Baseline

- Every direct npm dependency uses an exact reviewed version. `latest`, semver ranges, Git URLs, and remote tarballs are rejected.
- CI and production install the exact npm release declared by `packageManager`; local development accepts npm 11 and Node 22-24.
- Packages allowed to execute lifecycle scripts are reviewed and pinned by package and version in `allowScripts`.
- `package-lock.json` version 3 must match the manifest. Every registry package must resolve from `registry.npmjs.org` with SHA-512 integrity metadata.
- Docker base and service images are pinned to immutable SHA-256 manifest digests.
- GitHub Actions are pinned to full commit SHAs with the readable major tag retained in a comment.
- High and critical npm advisories block CI. Moderate advisories require a package-specific exception with rationale and an expiration no more than 90 days away.
- Each CI dependency graph produces a CycloneDX SBOM retained as a build artifact for 14 days.

Run the controls locally with:

```bash
npm ci
npm run supply-chain:check
npm run security:audit
npm run --silent security:sbom > domainscout-sbom.cdx.json
```

## Update Cadence

Dependabot opens grouped npm minor/patch updates weekly and GitHub Actions/Docker updates monthly. Major framework, database-client, CSS framework, Redis-client, and authentication changes are never grouped; schedule them as explicit upgrade phases with migration and rollback evidence.

Review moderate exceptions every Monday and remove an exception immediately when a compatible fix lands. CI fails after the recorded expiration date.

## Upgrade Evidence

Every dependency PR must record:

1. Previous and proposed versions, release notes, advisory impact, and whether the update changes a runtime boundary.
2. Lockfile-only diff review confirming registry URLs and integrity hashes.
3. Results for supply-chain policy, audit policy, lint, typecheck, unit tests, production build, asset budgets, database query profiles, and seeded Playwright workflows.
4. Railway deployment health and production smoke output for runtime changes.
5. Rollback target commit and container digest, plus any database compatibility constraint.

Use `docs/upgrade-evidence/TEMPLATE.md` in the PR description or release record.

## Framework Upgrades

- Upgrade `next`, `react`, `react-dom`, and `eslint-config-next` together when their compatibility matrix requires it.
- Upgrade `prisma` and `@prisma/client` together. Generate the client, validate every migration, and prove the previous application can still read the upgraded schema before rollout.
- Treat NextAuth/Auth.js, Tailwind, Redis, TypeScript, and Node major changes as dedicated phases with targeted workflow tests.
- Keep database migrations forward-compatible through the rollback window. If a migration is destructive, use an expand/migrate/contract sequence across separate releases.

## Rollback Procedure

1. Stop the rollout when CI, Railway health, authenticated workflows, or production smoke checks regress.
2. Redeploy the last green Git commit and its previously recorded image/dependency digests.
3. Do not reverse a database migration unless the migration runbook explicitly proves it safe; prefer rolling the application back against a backward-compatible schema.
4. Run `npm run smoke:production`, inspect Operations failures, and verify auth, billing webhook, provider, worker, and scheduler paths.
5. Record cause, affected versions, rollback commit, validation output, and the new upgrade prerequisite.
