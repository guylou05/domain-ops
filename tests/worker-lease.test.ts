import { describe, expect, it } from 'vitest';
import { nextLeaseExpiry, readLeaseMs, readWorkerId } from '../src/worker/lease';

describe('worker lease helpers', () => {
  it('uses configured worker ids when present', () => {
    expect(readWorkerId({ WORKER_ID: ' worker-a ' })).toBe('worker-a');
  });

  it('falls back to a process-scoped worker id', () => {
    expect(readWorkerId({ WORKER_ID: '   ' })).toBe(`worker-${process.pid}`);
  });

  it('reads lease durations with a production-safe minimum', () => {
    expect(readLeaseMs({ WORKER_LEASE_MS: '60000' })).toBe(60000);
    expect(readLeaseMs({ WORKER_LEASE_MS: '1000' })).toBe(10000);
    expect(readLeaseMs({ WORKER_LEASE_MS: 'invalid' })).toBe(300000);
  });

  it('calculates lease expiry from the supplied clock', () => {
    const now = new Date('2026-07-14T21:00:00.000Z');
    expect(nextLeaseExpiry(now, 45000).toISOString()).toBe('2026-07-14T21:00:45.000Z');
  });
});
