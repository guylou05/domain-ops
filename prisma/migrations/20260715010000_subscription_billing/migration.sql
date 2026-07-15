ALTER TABLE "Subscription"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "externalCustomerId" TEXT,
ADD COLUMN "externalSubscriptionId" TEXT,
ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Subscription_externalSubscriptionId_key"
ON "Subscription"("externalSubscriptionId");

CREATE INDEX "Subscription_externalCustomerId_idx"
ON "Subscription"("externalCustomerId");

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingEvent_providerEventId_key"
ON "BillingEvent"("providerEventId");

CREATE INDEX "BillingEvent_workspaceId_createdAt_idx"
ON "BillingEvent"("workspaceId", "createdAt");

ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
