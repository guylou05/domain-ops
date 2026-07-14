import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { WorkspaceContext } from './workspace-context';

type AuditEvent = {
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAuditEvent(context: WorkspaceContext, event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      metadata: event.metadata ?? {},
    },
  });
}
