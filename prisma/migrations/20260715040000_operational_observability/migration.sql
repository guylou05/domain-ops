CREATE TABLE "OperationalEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "correlationId" TEXT,
    "durationMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "alertedAt" TIMESTAMP(3),
    CONSTRAINT "OperationalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalEvent_workspaceId_occurredAt_idx"
ON "OperationalEvent"("workspaceId", "occurredAt");

CREATE INDEX "OperationalEvent_source_outcome_occurredAt_idx"
ON "OperationalEvent"("source", "outcome", "occurredAt");

CREATE INDEX "OperationalEvent_workspaceId_resolvedAt_occurredAt_idx"
ON "OperationalEvent"("workspaceId", "resolvedAt", "occurredAt");

ALTER TABLE "OperationalEvent"
ADD CONSTRAINT "OperationalEvent_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
