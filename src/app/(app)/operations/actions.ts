'use server';

import { revalidatePath } from 'next/cache';
import { recordAuditEvent } from '@/lib/server/audit';
import { getAppConfig, updateAppConfig } from '@/lib/server/app-config';
import { pruneOperationalEvents, resolveOperationalFailure } from '@/lib/server/observability';
import { assertVerifiedUser, assertWorkspaceAdmin, requireRecentStepUp, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function updateObservabilitySettings(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/operations');
  const current = await getAppConfig();
  const recipients = String(formData.get('emailRecipients') ?? '').split(/[\s,;]+/).filter(Boolean);
  const config = await updateAppConfig({
    observability: {
      retentionDays: Number(formData.get('retentionDays')),
      alertMinimumLevel: formData.get('alertMinimumLevel') === 'WARN' ? 'WARN' : 'ERROR',
      emailAlertsEnabled: formData.get('emailAlertsEnabled') === 'on',
      emailRecipients: recipients,
      alertCooldownMinutes: Number(formData.get('alertCooldownMinutes')),
    },
  });
  await recordAuditEvent(context, { action: 'observability.settings_updated', targetType: 'AppSetting', targetId: 'runtime', metadata: { previous: current.observability, next: config.observability } });
  revalidatePath('/operations');
  revalidatePath('/settings');
}

export async function resolveFailure(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  const id = String(formData.get('id') ?? '');
  if (!id || !(await resolveOperationalFailure(id, context.workspaceId))) throw new Error('The unresolved operational failure was not found.');
  await recordAuditEvent(context, { action: 'observability.failure_resolved', targetType: 'OperationalEvent', targetId: id });
  revalidatePath('/operations');
}

export async function runRetentionNow(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/operations');
  const config = await getAppConfig();
  const deleted = await pruneOperationalEvents(config.observability.retentionDays, context.workspaceId);
  await recordAuditEvent(context, { action: 'observability.retention_run', targetType: 'OperationalEvent', metadata: { deleted, retentionDays: config.observability.retentionDays } });
  revalidatePath('/operations');
}
