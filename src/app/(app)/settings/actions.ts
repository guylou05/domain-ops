'use server';

import { compare, hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { updateAppConfig } from '@/lib/server/app-config';
import { assertVerifiedUser, assertWorkspaceAdmin, assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';
import type { AuthActionState } from '@/app/(auth)/auth-state';

export async function changeCurrentPassword(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireWorkspaceContext();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');
  if (newPassword.length < 8) return { ok: false, message: 'New password must be at least 8 characters.' };
  if (newPassword !== confirmation) return { ok: false, message: 'New passwords do not match.' };
  if (currentPassword === newPassword) return { ok: false, message: 'Choose a different password.' };

  const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await compare(currentPassword, user.passwordHash))) {
    return { ok: false, message: 'Current password is incorrect.' };
  }

  await prisma.user.update({ where: { id: context.userId }, data: { passwordHash: await hash(newPassword, 10) } });
  await prisma.passwordResetToken.updateMany({ where: { userId: context.userId, usedAt: null }, data: { usedAt: new Date() } });
  await recordAuditEvent(context, { action: 'account.password_changed', targetType: 'User', targetId: context.userId });
  return { ok: true, message: 'Password changed successfully.' };
}

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
  assertVerifiedUser(context);

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
    transactionalEmail: {
      enabled: formData.get('transactionalEmailEnabled') === 'on',
      sender: String(formData.get('transactionalEmailSender') ?? ''),
      endpoint: String(formData.get('transactionalEmailEndpoint') ?? ''),
    },
    billing: {
      mode: (() => {
        const value = String(formData.get('billingMode') ?? 'off');
        return value === 'test' || value === 'live' ? value : 'off';
      })(),
      currency: String(formData.get('billingCurrency') ?? 'usd'),
    },
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
