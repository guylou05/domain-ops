-- Add lease fields so multiple worker processes can safely claim queued jobs.
ALTER TABLE "BackgroundJob" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "BackgroundJob" ADD COLUMN "lockedBy" TEXT;
ALTER TABLE "BackgroundJob" ADD COLUMN "lockExpiresAt" TIMESTAMP(3);

CREATE INDEX "BackgroundJob_status_lockExpiresAt_idx" ON "BackgroundJob"("status", "lockExpiresAt");
