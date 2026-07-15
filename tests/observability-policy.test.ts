import { describe, expect, it } from 'vitest';
import { operationalRetentionCutoff, operationalSourceStatus, shouldRouteOperationalAlert } from '../src/lib/observability-policy';

describe('observability policy', () => {
  it('routes only events at or above the configured threshold', () => {
    expect(shouldRouteOperationalAlert('WARN', 'ERROR')).toBe(false);
    expect(shouldRouteOperationalAlert('ERROR', 'ERROR')).toBe(true);
    expect(shouldRouteOperationalAlert('WARN', 'WARN')).toBe(true);
  });

  it('reports unresolved failures as degraded and stale sources as idle', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    expect(operationalSourceStatus([{ outcome: 'FAILURE', occurredAt: now, resolvedAt: null }], now)).toBe('degraded');
    expect(operationalSourceStatus([{ outcome: 'SUCCESS', occurredAt: now, resolvedAt: null }], now)).toBe('healthy');
    expect(operationalSourceStatus([{ outcome: 'SUCCESS', occurredAt: new Date('2026-07-13T00:00:00Z'), resolvedAt: null }], now)).toBe('idle');
  });

  it('calculates a retention cutoff in whole days', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    expect(operationalRetentionCutoff(30, now).toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });
});
