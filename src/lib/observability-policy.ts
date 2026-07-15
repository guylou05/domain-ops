export const OPERATIONAL_SOURCES = ['request', 'worker', 'scheduler', 'provider', 'webhook'] as const;
export type OperationalSource = (typeof OPERATIONAL_SOURCES)[number];
export type OperationalLevel = 'INFO' | 'WARN' | 'ERROR';
export type OperationalOutcome = 'SUCCESS' | 'FAILURE';

const LEVEL_PRIORITY: Record<OperationalLevel, number> = { INFO: 0, WARN: 1, ERROR: 2 };

export function shouldRouteOperationalAlert(level: OperationalLevel, minimumLevel: 'WARN' | 'ERROR'): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimumLevel];
}

export function operationalRetentionCutoff(retentionDays: number, now = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function operationalSourceStatus(
  events: Array<{ outcome: string; occurredAt: Date; resolvedAt: Date | null }>,
  now = new Date(),
): 'healthy' | 'degraded' | 'idle' {
  const unresolvedFailure = events.some((event) => event.outcome === 'FAILURE' && !event.resolvedAt);
  if (unresolvedFailure) return 'degraded';
  const latest = events.reduce<Date | null>((current, event) => (!current || event.occurredAt > current ? event.occurredAt : current), null);
  return latest && now.getTime() - latest.getTime() <= 24 * 60 * 60 * 1000 ? 'healthy' : 'idle';
}
