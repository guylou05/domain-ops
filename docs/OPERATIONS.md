# Production Operations Runbook

## Service Objectives

- Availability signal: `GET /api/health` must return HTTP 200 with `database: "connected"`.
- Recovery point objective: no more than 24 hours of database data loss.
- Recovery time objective: restore service within 2 hours of declaring a database incident.
- Retention: keep 14 daily backups and 3 monthly recovery points in encrypted storage outside the application project.

## Backup Procedure

Use PostgreSQL 16 client tools. `DATABASE_URL` can be used from a private Railway task; an operator workstation must use a temporary public database URL with restricted access.

```bash
export BACKUP_FILE="domainscout-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname "$DATABASE_URL" --file "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
pg_restore --list "$BACKUP_FILE" > "$BACKUP_FILE.manifest"
```

Encrypt the dump and upload it to the approved backup location. Store the checksum and manifest beside it. Never commit dumps, database URLs, `NEXTAUTH_SECRET`, or `ENCRYPTION_KEY` to Git.

The credential vault depends on the deployment `ENCRYPTION_KEY`. Back up that secret through the organization secret manager separately from PostgreSQL and test access during each recovery drill.

## Restore Rehearsal

Perform this monthly against an isolated, empty PostgreSQL database. The command below destroys existing objects in the target database; verify `RESTORE_DATABASE_URL` is not production before running it.

```bash
sha256sum --check "$BACKUP_FILE.sha256"
pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --dbname "$RESTORE_DATABASE_URL" "$BACKUP_FILE"
DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:status
DATABASE_URL="$RESTORE_DATABASE_URL" npm run perf:queries
```

Then start an isolated web instance with the restored database and verify login, workspace resolution, opportunity lists, Operations history, and a read-only report. Record backup age, restore duration, row-count spot checks, and the operator in the incident log.

## Production Recovery

1. Declare the incident, stop scheduler and worker services, and prevent application writes.
2. Preserve a final snapshot of the damaged database when possible.
3. Create a new PostgreSQL service or empty recovery database; do not restore over the only copy.
4. Restore the latest verified dump and apply any migrations newer than the backup with `npm run db:deploy`.
5. Point a temporary web service at the restored database and run `npm run smoke:production` with its URL.
6. Update service references, restart the web service, then restart one scheduler replica.
7. Confirm `/api/health`, queue processing, Stripe webhook delivery, provider credentials, and Operations telemetry before reopening traffic.
8. Record actual RPO/RTO, affected data, corrective actions, and the next rehearsal date.

## Routine Release Check

```bash
npm ci
npx prisma generate
npm run db:validate
npm run supply-chain:check
npm run security:audit
npm run lint
npm run typecheck
npm test
npm run build
npm run perf:budget
npm run perf:queries
npm run smoke:production
```

GitHub runs static/build, browser workflow, query profile, and asset-budget gates. The separate Production smoke workflow runs daily and can be started manually after a deployment.
