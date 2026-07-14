-- Ensure the public plan catalog exists in production even when demo seeding is skipped.
INSERT INTO "Plan" ("id", "name", "priceCents")
VALUES ('plan_professional', 'Professional', 9900)
ON CONFLICT ("name") DO UPDATE SET "priceCents" = EXCLUDED."priceCents";

INSERT INTO "FeatureEntitlement" ("id", "planId", "key", "limit", "enabled")
SELECT 'entitlement_professional_domain_checks', "id", 'domain_checks', 5000, true
FROM "Plan" WHERE "name" = 'Professional'
ON CONFLICT ("planId", "key") DO UPDATE SET "limit" = EXCLUDED."limit", "enabled" = true;

INSERT INTO "FeatureEntitlement" ("id", "planId", "key", "limit", "enabled")
SELECT 'entitlement_professional_buyer_research', "id", 'buyer_research', 500, true
FROM "Plan" WHERE "name" = 'Professional'
ON CONFLICT ("planId", "key") DO UPDATE SET "limit" = EXCLUDED."limit", "enabled" = true;

INSERT INTO "FeatureEntitlement" ("id", "planId", "key", "limit", "enabled")
SELECT 'entitlement_professional_reports', "id", 'reports_generated', 100, true
FROM "Plan" WHERE "name" = 'Professional'
ON CONFLICT ("planId", "key") DO UPDATE SET "limit" = EXCLUDED."limit", "enabled" = true;

INSERT INTO "FeatureEntitlement" ("id", "planId", "key", "limit", "enabled")
SELECT 'entitlement_professional_due_diligence', "id", 'due_diligence_checks', 500, true
FROM "Plan" WHERE "name" = 'Professional'
ON CONFLICT ("planId", "key") DO UPDATE SET "limit" = EXCLUDED."limit", "enabled" = true;

ALTER TABLE "Subscription" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Subscription_workspaceId_status_createdAt_idx"
ON "Subscription"("workspaceId", "status", "createdAt");
