'use server';

import { Status } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function readIntegrationId(formData: FormData): string {
  const id = String(formData.get('integrationId') ?? '').trim();
  if (!id) throw new Error('integrationId is required.');
  return id;
}

export async function toggleIntegrationStatus(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const integrationId = readIntegrationId(formData);
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      workspaceId: context.workspaceId,
    },
    select: {
      id: true,
      provider: true,
      status: true,
    },
  });

  if (!integration) throw new Error('Integration was not found in this workspace.');

  const status = integration.status === Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
  await prisma.integration.update({
    where: { id: integration.id },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: 'integration.status_toggled',
      targetType: 'Integration',
      targetId: integration.id,
      metadata: { provider: integration.provider, status },
    },
  });

  revalidatePath('/integrations');
  revalidatePath('/admin');
  revalidatePath('/settings');
}
