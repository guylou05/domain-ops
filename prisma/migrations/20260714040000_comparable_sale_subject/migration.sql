ALTER TABLE "ComparableSale" ADD COLUMN "subjectDomain" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ComparableSale" ALTER COLUMN "subjectDomain" DROP DEFAULT;

DROP INDEX "ComparableSale_domain_price_saleDate_key";

CREATE UNIQUE INDEX "ComparableSale_subjectDomain_domain_price_saleDate_key"
ON "ComparableSale"("subjectDomain", "domain", "price", "saleDate");

