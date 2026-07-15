# Discovery Operations and Data Mobility

## Discovery Sources

The Discovery workspace supports manual, generated, expired, auction, closeout, trend, and external-provider source labels. Phase 11 runs these through the configured registrar adapter and records the exact source on every persisted domain. External-provider discovery uses the existing provider boundary; production provider contracts and synchronization remain Phase 12 work.

One-off source runs execute immediately and persist progress, result count, timestamps, and errors in `DiscoveryJob`. Saved searches support manual, daily, and weekly schedules. Running a saved search creates a cancellable discovery job plus a `scheduled_discovery` background job. The Redis-coordinated scheduler scans due searches at the cadence configured in Runtime Settings.

## CSV Import

CSV uploads must contain a `domain` or `name` column, are limited to 2 MB and 2,000 rows, and are parsed with Papa Parse. The review step persists every valid, duplicate, and erroneous row in an `ImportBatch`; nothing invalid is silently discarded. Existing workspace domains and repeated file rows are labeled as duplicates. Cells beginning with spreadsheet formula characters are rejected during import.

Only rows labeled `VALID` can be imported. Import actions re-check workspace ownership, consume the existing domain-check entitlement, and record audit events. Opportunity and portfolio exports quote every field and prefix formula-like values before producing private, non-cacheable CSV responses.

## Bulk Review and Isolation

Opportunity checkboxes support comparison, approval, and watchlist actions for up to 100 records. Every server mutation scopes selected identifiers to the authenticated workspace and rejects viewer writes. Approval records the actor and timestamp. Import batch lookup and both export routes derive workspace context server-side.

## Deployment and Rollback

Apply migration `20260715060000_discovery_operations` before starting the new application build. It activates existing discovery tables, adds opportunity approval fields and indexes, and creates `ImportBatch`. Existing saved searches receive a creator from their workspace membership; orphan searches without any workspace member are removed because they cannot be authorized or executed.

Rollback must be a forward migration. Export discovery jobs, saved searches, import batches, and opportunity approval values before removing the new fields. After deployment, verify `/discovery`, both CSV export endpoints, one scheduled-search queue/cancel cycle, one reviewed import, and a `scheduled_discovery` worker run.
