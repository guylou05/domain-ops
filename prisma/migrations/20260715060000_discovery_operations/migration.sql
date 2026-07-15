ALTER TABLE "DomainOpportunity"
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT;

ALTER TABLE "DiscoveryJob"
  ADD COLUMN "savedSearchId" TEXT,
  ADD COLUMN "resultCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

ALTER TABLE "SavedSearch"
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN "lastRunAt" TIMESTAMP(3),
  ADD COLUMN "nextRunAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "SavedSearch" search
SET "createdById" = member."userId"
FROM "WorkspaceMember" member
WHERE member."workspaceId" = search."workspaceId"
  AND search."createdById" IS NULL;

DELETE FROM "SavedSearch" WHERE "createdById" IS NULL;
ALTER TABLE "SavedSearch" ALTER COLUMN "createdById" SET NOT NULL;

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVIEW',
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL,
  "errorRows" INTEGER NOT NULL,
  "rows" JSONB NOT NULL,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryJob_workspaceId_status_createdAt_idx" ON "DiscoveryJob"("workspaceId", "status", "createdAt");
CREATE INDEX "DiscoveryJob_savedSearchId_createdAt_idx" ON "DiscoveryJob"("savedSearchId", "createdAt");
CREATE UNIQUE INDEX "DiscoverySource_name_type_key" ON "DiscoverySource"("name", "type");
CREATE INDEX "SavedSearch_workspaceId_status_nextRunAt_idx" ON "SavedSearch"("workspaceId", "status", "nextRunAt");
CREATE INDEX "ImportBatch_workspaceId_status_createdAt_idx" ON "ImportBatch"("workspaceId", "status", "createdAt");
