'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { updateAppConfig } from '@/lib/server/app-config';
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

export async function updateRuntimeSettings(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const availabilityProvider = String(formData.get('availabilityProvider') ?? 'mock');
  const workerJobLimit = Number(formData.get('workerJobLimit'));
  const workerLeaseMs = Number(formData.get('workerLeaseMs'));
  const authDiagnosticsEnabled = formData.get('authDiagnosticsEnabled') === 'on';

  const config = await updateAppConfig({
    availabilityProvider: availabilityProvider === 'deterministic' || availabilityProvider === 'mock' || availabilityProvider === 'live' ? availabilityProvider : 'mock',
    workerJobLimit,
    workerLeaseMs,
    authDiagnosticsEnabled,
  });

  await recordAuditEvent(context, {
    action: 'runtime_settings.updated',
    targetType: 'AppSetting',
    targetId: 'runtime',
    metadata: config,
  });

  revalidatePath('/settings');
  revalidatePath('/integrations');
  revalidatePath('/admin');
}
