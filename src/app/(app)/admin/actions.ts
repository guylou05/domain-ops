'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { assertWorkspaceAdmin, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function toggleFeatureFlag(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
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

  await recordAuditEvent(context, {
    action: 'feature_flag.toggled',
    targetType: 'FeatureFlag',
    targetId: flag.key,
    metadata: { enabled },
  });

  revalidatePath('/admin');
  revalidatePath('/settings');
  revalidatePath('/integrations');
}
