CREATE INDEX "UsageRecord_workspaceId_key_createdAt_idx"
ON "UsageRecord"("workspaceId", "key", "createdAt");

INSERT INTO "FeatureEntitlement" ("id", "planId", "key", "limit", "enabled")
SELECT 'entitlement_professional_reports', "id", 'reports_generated', 100, true
FROM "Plan" WHERE "name" = 'Professional'
ON CONFLICT ("planId", "key") DO UPDATE SET "limit" = EXCLUDED."limit", "enabled" = true;

INSERT INTO "FeatureEntitlement" ("id", "planId", "key", "limit", "enabled")
SELECT 'entitlement_professional_due_diligence', "id", 'due_diligence_checks', 500, true
FROM "Plan" WHERE "name" = 'Professional'
ON CONFLICT ("planId", "key") DO UPDATE SET "limit" = EXCLUDED."limit", "enabled" = true;

UPDATE "FeatureEntitlement" SET "limit" = 500
WHERE "key" = 'buyer_research' AND "planId" IN (SELECT "id" FROM "Plan" WHERE "name" = 'Professional');
