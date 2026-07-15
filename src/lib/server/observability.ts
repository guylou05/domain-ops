import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  operationalRetentionCutoff,
  operationalSourceStatus,
  shouldRouteOperationalAlert,
  type OperationalLevel,
  type OperationalOutcome,
  type OperationalSource,
} from '@/lib/observability-policy';
import { sendTransactionalEmail } from '@/lib/providers/transactional-email';
import { getAppConfig } from './app-config';
import { resolveProviderCredential } from './provider-credentials';

export type OperationalEventInput = {
  workspaceId?: string | null;
  source: OperationalSource;
  level: OperationalLevel;
  outcome: OperationalOutcome;
  event: string;
  message: string;
  correlationId?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

async function routeOperationalAlert(saved: { id: string; workspaceId: string | null; source: string; level: string; event: string; message: string }) {
  if (!saved.workspaceId || (saved.level !== 'WARN' && saved.level !== 'ERROR')) return;
  const config = await getAppConfig();
  const alerts = config.observability;
  if (!alerts.emailAlertsEnabled || alerts.emailRecipients.length === 0 || !shouldRouteOperationalAlert(saved.level, alerts.alertMinimumLevel)) return;

  const cooldownStart = new Date(Date.now() - alerts.alertCooldownMinutes * 60 * 1000);
  const recent = await prisma.operationalEvent.findFirst({
    where: { workspaceId: saved.workspaceId, source: saved.source, event: saved.event, alertedAt: { gte: cooldownStart } },
    select: { id: true },
  });
  if (recent) return;

  const apiKey = await resolveProviderCredential(saved.workspaceId, 'transactional_email');
  if (!config.transactionalEmail.enabled || !config.transactionalEmail.sender || !apiKey) return;
  await Promise.all(alerts.emailRecipients.map((recipient, index) => sendTransactionalEmail(config.transactionalEmail.endpoint, apiKey, {
    to: recipient,
    from: config.transactionalEmail.sender,
    subject: `[DomainScout AI] ${saved.level}: ${saved.event}`,
    html: `<p><strong>${escapeHtml(saved.source)}</strong> reported ${escapeHtml(saved.level)}.</p><p>${escapeHtml(saved.message)}</p>`,
    text: `${saved.source} reported ${saved.level}: ${saved.message}`,
    idempotencyKey: `${saved.id}:${index}`,
  })));
  await prisma.operationalEvent.update({ where: { id: saved.id }, data: { alertedAt: new Date() } });
}

export async function recordOperationalEvent(input: OperationalEventInput) {
  const saved = await prisma.operationalEvent.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      source: input.source,
      level: input.level,
      outcome: input.outcome,
      event: input.event.slice(0, 120),
      message: input.message.slice(0, 1000),
      correlationId: input.correlationId?.slice(0, 160) ?? null,
      durationMs: input.durationMs == null ? null : Math.max(0, Math.round(input.durationMs)),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true, workspaceId: true, source: true, level: true, event: true, message: true, occurredAt: true },
  });
  console.log(JSON.stringify({ type: 'operational_event', ...saved, outcome: input.outcome, durationMs: input.durationMs ?? null, correlationId: input.correlationId ?? null }));
  await routeOperationalAlert(saved).catch((error) => console.error('[observability] alert delivery failed', error instanceof Error ? error.message : error));
  return saved;
}

export async function safeRecordOperationalEvent(input: OperationalEventInput): Promise<void> {
  await recordOperationalEvent(input).catch((error) => console.error('[observability] event persistence failed', error instanceof Error ? error.message : error));
}

export async function observeOperationalCall<T>(input: Omit<OperationalEventInput, 'level' | 'outcome' | 'message' | 'durationMs'>, callback: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await callback();
    await safeRecordOperationalEvent({ ...input, level: 'INFO', outcome: 'SUCCESS', message: `${input.event} completed.`, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : `${input.event} failed.`;
    await safeRecordOperationalEvent({ ...input, level: 'ERROR', outcome: 'FAILURE', message, durationMs: Date.now() - startedAt });
    throw error;
  }
}

export async function pruneOperationalEvents(retentionDays: number, workspaceId?: string): Promise<number> {
  const result = await prisma.operationalEvent.deleteMany({
    where: { ...(workspaceId ? { workspaceId } : {}), occurredAt: { lt: operationalRetentionCutoff(retentionDays) } },
  });
  return result.count;
}

export async function resolveOperationalFailure(id: string, workspaceId: string): Promise<boolean> {
  const result = await prisma.operationalEvent.updateMany({
    where: { id, OR: [{ workspaceId }, { workspaceId: null }], outcome: 'FAILURE', resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  return result.count === 1;
}

export async function getOperationalDashboard(workspaceId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const visible = { OR: [{ workspaceId }, { workspaceId: null }] };
  const [recentEvents, failures24h, unresolvedEvents] = await Promise.all([
    prisma.operationalEvent.findMany({ where: visible, orderBy: { occurredAt: 'desc' }, take: 80 }),
    prisma.operationalEvent.count({ where: { ...visible, outcome: 'FAILURE', occurredAt: { gte: since } } }),
    prisma.operationalEvent.findMany({
      where: { ...visible, outcome: 'FAILURE', resolvedAt: null },
      orderBy: { occurredAt: 'desc' },
      take: 25,
    }),
  ]);
  const sources = (['request', 'worker', 'scheduler', 'provider', 'webhook'] as const).map((source) => {
    const events = recentEvents.filter((item) => item.source === source);
    return {
      source,
      status: operationalSourceStatus(events),
      latestAt: events[0]?.occurredAt ?? null,
      failures: events.filter((item) => item.outcome === 'FAILURE' && !item.resolvedAt).length,
    };
  });
  return { recentEvents, failures24h, unresolvedFailures: unresolvedEvents.length, unresolvedEvents, sources };
}
