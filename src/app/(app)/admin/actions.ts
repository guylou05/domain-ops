'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';

async function requireWorkspaceAdmin() {
  const context = await requireWorkspaceContext();
  if (context.role !== 'OWNER' && context.role !== 'ADMIN') {
    throw new Error('Admin actions require OWNER or ADMIN access.');
  }
  return context;
}

export async function toggleFeatureFlag(formData: FormData): Promise<void> {
  const context = await requireWorkspaceAdmin();
  const key = String(formData.get('key') ?? '').trim();
  if (!key) throw new Error('Feature flag key is required.');

  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { key: true, enabled: true },
  });

  if (!flag) throw new Error('Feature flag was not found.');

  const enabled = !flag.enabled;
  await prisma.featureFlag.update({
    where: { key: flag.key },
    data: { enabled },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: 'feature_flag.toggled',
      targetType: 'FeatureFlag',
      targetId: flag.key,
      metadata: { enabled },
    },
  });

  revalidatePath('/admin');
  revalidatePath('/settings');
  revalidatePath('/integrations');
}
