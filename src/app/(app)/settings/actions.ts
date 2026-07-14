'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { updateAppConfig } from '@/lib/server/app-config';
import { assertWorkspaceAdmin, assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

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
  assertWorkspaceAdmin(context);

  const availabilityProvider = String(formData.get('availabilityProvider') ?? 'mock');
  const readProvider = (name: string) => {
    const value = String(formData.get(name) ?? 'mock');
    return value === 'deterministic' || value === 'mock' || value === 'live' ? value : 'mock';
  };
  const workerJobLimit = Number(formData.get('workerJobLimit'));
  const workerLeaseMs = Number(formData.get('workerLeaseSeconds')) * 1000;
  const authDiagnosticsEnabled = formData.get('authDiagnosticsEnabled') === 'on';
  const schedulerEnabled = formData.get('schedulerEnabled') === 'on';
  const schedulerPollMs = Number(formData.get('schedulerPollSeconds')) * 1000;

  const config = await updateAppConfig({
    availabilityProvider: availabilityProvider === 'deterministic' || availabilityProvider === 'mock' || availabilityProvider === 'live' ? availabilityProvider : 'mock',
    trademarkProvider: readProvider('trademarkProvider'),
    comparableSalesProvider: readProvider('comparableSalesProvider'),
    historyProvider: readProvider('historyProvider'),
    providerEndpoints: {
      registrar: String(formData.get('registrarEndpoint') ?? ''),
      trademark: String(formData.get('trademarkEndpoint') ?? ''),
      comparableSales: String(formData.get('comparableSalesEndpoint') ?? ''),
      history: String(formData.get('historyEndpoint') ?? ''),
    },
    workerJobLimit,
    workerLeaseMs,
    authDiagnosticsEnabled,
    schedulerEnabled,
    schedulerPollMs,
    jobSchedules: {
      dailyOpportunityDigest: {
        enabled: formData.get('dailyOpportunityDigestEnabled') === 'on',
        intervalMinutes: Number(formData.get('dailyOpportunityDigestIntervalMinutes')),
      },
      buyerResearchRefresh: {
        enabled: formData.get('buyerResearchRefreshEnabled') === 'on',
        intervalMinutes: Number(formData.get('buyerResearchRefreshIntervalMinutes')),
      },
      portfolioSnapshot: {
        enabled: formData.get('portfolioSnapshotEnabled') === 'on',
        intervalMinutes: Number(formData.get('portfolioSnapshotIntervalMinutes')),
      },
    },
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
