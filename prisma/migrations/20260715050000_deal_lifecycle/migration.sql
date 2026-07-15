ALTER TABLE "PortfolioItem"
  ADD COLUMN "minSalePrice" DECIMAL(65,30),
  ADD COLUMN "purchaseSource" TEXT,
  ADD COLUMN "nameservers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Offer"
  ADD COLUMN "buyerName" TEXT,
  ADD COLUMN "buyerEmail" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Sale"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Renewal"
  ADD COLUMN "decision" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PortfolioItem_workspaceId_status_expirationDate_idx" ON "PortfolioItem"("workspaceId", "status", "expirationDate");
CREATE INDEX "PortfolioItem_workspaceId_domainId_idx" ON "PortfolioItem"("workspaceId", "domainId");
CREATE INDEX "Offer_workspaceId_status_createdAt_idx" ON "Offer"("workspaceId", "status", "createdAt");
CREATE INDEX "Offer_domainId_idx" ON "Offer"("domainId");
CREATE INDEX "Sale_workspaceId_saleDate_idx" ON "Sale"("workspaceId", "saleDate");
CREATE INDEX "Sale_domainId_idx" ON "Sale"("domainId");
CREATE UNIQUE INDEX "Renewal_workspaceId_domainId_dueDate_key" ON "Renewal"("workspaceId", "domainId", "dueDate");
CREATE INDEX "Renewal_workspaceId_status_dueDate_idx" ON "Renewal"("workspaceId", "status", "dueDate");
