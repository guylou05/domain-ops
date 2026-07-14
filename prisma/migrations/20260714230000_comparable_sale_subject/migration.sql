ALTER TABLE "ComparableSale" ADD COLUMN IF NOT EXISTS "subjectDomain" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ComparableSale" ALTER COLUMN "subjectDomain" DROP DEFAULT;

DROP INDEX IF EXISTS "ComparableSale_domain_price_saleDate_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ComparableSale_subjectDomain_domain_price_saleDate_key"
ON "ComparableSale"("subjectDomain", "domain", "price", "saleDate");

