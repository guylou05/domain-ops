DELETE FROM "ApiCredential" older
USING "ApiCredential" newer
WHERE older."workspaceId" = newer."workspaceId"
  AND older."provider" = newer."provider"
  AND (older."createdAt" < newer."createdAt" OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id"));

ALTER TABLE "ApiCredential" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ApiCredential" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX "ApiCredential_workspaceId_provider_key"
ON "ApiCredential"("workspaceId", "provider");
