'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function updateWorkspaceName(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) throw new Error('Workspace name must be at least 2 characters.');

  await prisma.workspace.update({
    where: { id: context.workspaceId },
    data: { name },
  });

  await recordAuditEvent(context, {
    action: 'workspace.name_updated',
    targetType: 'Workspace',
    targetId: context.workspaceId,
    metadata: { name },
  });

  revalidatePath('/settings');
  revalidatePath('/admin');
  revalidatePath('/overview');
}
