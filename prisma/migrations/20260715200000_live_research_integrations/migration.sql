ALTER TABLE "ComparableSale"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "evidenceUrl" TEXT,
  ADD COLUMN "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ComparableSale" sale
SET "workspaceId" = (
  SELECT domain."workspaceId"
  FROM "Domain" domain
  WHERE domain."name" = sale."subjectDomain"
  ORDER BY domain."createdAt" ASC
  LIMIT 1
);

DELETE FROM "ComparableSale" WHERE "workspaceId" IS NULL;
ALTER TABLE "ComparableSale" ALTER COLUMN "workspaceId" SET NOT NULL;
DROP INDEX "ComparableSale_subjectDomain_domain_price_saleDate_key";
CREATE UNIQUE INDEX "ComparableSale_workspaceId_subjectDomain_domain_price_saleDate_key" ON "ComparableSale"("workspaceId", "subjectDomain", "domain", "price", "saleDate");
CREATE INDEX "ComparableSale_workspaceId_subjectDomain_saleDate_idx" ON "ComparableSale"("workspaceId", "subjectDomain", "saleDate");

CREATE TABLE "ComparableSaleImportBatch" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVIEW',
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL,
  "errorRows" INTEGER NOT NULL,
  "rows" JSONB NOT NULL,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparableSaleImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComparableSaleImportBatch_workspaceId_status_createdAt_idx" ON "ComparableSaleImportBatch"("workspaceId", "status", "createdAt");

CREATE TABLE "ProviderCache" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "staleAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderCache_workspaceId_provider_cacheKey_key" ON "ProviderCache"("workspaceId", "provider", "cacheKey");
CREATE INDEX "ProviderCache_workspaceId_provider_expiresAt_idx" ON "ProviderCache"("workspaceId", "provider", "expiresAt");

CREATE TABLE "ProviderUsage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "cacheHits" INTEGER NOT NULL DEFAULT 0,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "lastRequestAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderUsage_workspaceId_provider_periodStart_key" ON "ProviderUsage"("workspaceId", "provider", "periodStart");
CREATE INDEX "ProviderUsage_workspaceId_periodStart_idx" ON "ProviderUsage"("workspaceId", "periodStart");

CREATE TABLE "ResearchConsent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "acceptedById" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ResearchConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResearchConsent_workspaceId_provider_policyVersion_key" ON "ResearchConsent"("workspaceId", "provider", "policyVersion");
CREATE INDEX "ResearchConsent_workspaceId_provider_revokedAt_idx" ON "ResearchConsent"("workspaceId", "provider", "revokedAt");

CREATE TABLE "PublicBusinessEvidence" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "subjectDomain" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "jurisdiction" TEXT,
  "identifier" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicBusinessEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicBusinessEvidence_workspaceId_subjectDomain_provider_companyName_sourceUrl_key" ON "PublicBusinessEvidence"("workspaceId", "subjectDomain", "provider", "companyName", "sourceUrl");
CREATE INDEX "PublicBusinessEvidence_workspaceId_subjectDomain_fetchedAt_idx" ON "PublicBusinessEvidence"("workspaceId", "subjectDomain", "fetchedAt");
