ALTER TABLE "Buyer"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Buyer_workspaceId_outreachStatus_relevanceScore_idx" ON "Buyer"("workspaceId", "outreachStatus", "relevanceScore");

ALTER TABLE "BuyerContact"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "optedOutAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "BuyerContact" contact SET "workspaceId" = buyer."workspaceId" FROM "Buyer" buyer WHERE buyer."id" = contact."buyerId";
DELETE FROM "BuyerContact" WHERE "workspaceId" IS NULL;
ALTER TABLE "BuyerContact" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "BuyerContact_workspaceId_email_status_idx" ON "BuyerContact"("workspaceId", "email", "status");

ALTER TABLE "OutreachCampaign"
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "OutreachCampaign" campaign SET "createdById" = member."userId" FROM "WorkspaceMember" member WHERE member."workspaceId" = campaign."workspaceId" AND campaign."createdById" IS NULL;
DELETE FROM "OutreachCampaign" WHERE "createdById" IS NULL;
ALTER TABLE "OutreachCampaign" ALTER COLUMN "createdById" SET NOT NULL;
CREATE INDEX "OutreachCampaign_workspaceId_status_createdAt_idx" ON "OutreachCampaign"("workspaceId", "status", "createdAt");

ALTER TABLE "OutreachMessage"
  ADD COLUMN "buyerId" TEXT,
  ADD COLUMN "contactId" TEXT,
  ADD COLUMN "domainId" TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "sequenceStep" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "responseStatus" TEXT,
  ADD COLUMN "responseBody" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "offerId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "OutreachMessage_workspaceId_status_scheduledAt_idx" ON "OutreachMessage"("workspaceId", "status", "scheduledAt");
CREATE INDEX "OutreachMessage_contactId_createdAt_idx" ON "OutreachMessage"("contactId", "createdAt");
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "BuyerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OutreachTemplate" ("id" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"createdById" TEXT NOT NULL,"name" TEXT NOT NULL,"subject" TEXT NOT NULL,"body" TEXT NOT NULL,"status" "Status" NOT NULL DEFAULT 'ACTIVE',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "OutreachTemplate_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OutreachTemplate_workspaceId_name_key" ON "OutreachTemplate"("workspaceId", "name");

CREATE TABLE "OutreachTask" ("id" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"campaignId" TEXT,"assignedToId" TEXT,"title" TEXT NOT NULL,"notes" TEXT,"dueAt" TIMESTAMP(3),"status" TEXT NOT NULL DEFAULT 'OPEN',"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "OutreachTask_pkey" PRIMARY KEY ("id"));
CREATE INDEX "OutreachTask_workspaceId_status_dueAt_idx" ON "OutreachTask"("workspaceId", "status", "dueAt");
ALTER TABLE "OutreachTask" ADD CONSTRAINT "OutreachTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ContactActivity" ("id" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"buyerId" TEXT NOT NULL,"contactId" TEXT,"actorId" TEXT,"type" TEXT NOT NULL,"summary" TEXT NOT NULL,"metadata" JSONB NOT NULL DEFAULT '{}',"occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ContactActivity_workspaceId_buyerId_occurredAt_idx" ON "ContactActivity"("workspaceId", "buyerId", "occurredAt");
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "BuyerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OutreachSuppression" ("id" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"email" TEXT NOT NULL,"reason" TEXT NOT NULL,"source" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,"createdById" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"revokedAt" TIMESTAMP(3),CONSTRAINT "OutreachSuppression_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OutreachSuppression_workspaceId_email_key" ON "OutreachSuppression"("workspaceId", "email");
CREATE INDEX "OutreachSuppression_workspaceId_active_createdAt_idx" ON "OutreachSuppression"("workspaceId", "active", "createdAt");

CREATE TABLE "OutreachDeliveryEvent" ("id" TEXT NOT NULL,"workspaceId" TEXT NOT NULL,"messageId" TEXT NOT NULL,"provider" TEXT NOT NULL,"status" TEXT NOT NULL,"providerId" TEXT,"detail" TEXT,"metadata" JSONB NOT NULL DEFAULT '{}',"occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "OutreachDeliveryEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "OutreachDeliveryEvent_workspaceId_status_occurredAt_idx" ON "OutreachDeliveryEvent"("workspaceId", "status", "occurredAt");
ALTER TABLE "OutreachDeliveryEvent" ADD CONSTRAINT "OutreachDeliveryEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "OutreachMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
