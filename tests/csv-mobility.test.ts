import { describe, expect, it } from 'vitest';
import { createCsv, reviewDomainCsv } from '../src/lib/csv-mobility';
import { nextDiscoveryRun } from '../src/lib/discovery-cadence';

describe('CSV mobility', () => {
  it('reviews valid, duplicate, malformed, and formula rows without silently dropping them', () => {
    const rows = reviewDomainCsv('domain\nnewbrand.com\nexisting.com\nnewbrand.com\nnot a domain\n=cmd()', ['existing.com']);
    expect(rows.filter((row) => row.status === 'VALID')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'DUPLICATE')).toHaveLength(2);
    expect(rows.filter((row) => row.status === 'ERROR').length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.message.length > 0)).toBe(true);
  });

  it('neutralizes spreadsheet formulas in exports', () => {
    expect(createCsv(['domain'], [['=HYPERLINK("bad")']])).toContain("'=HYPERLINK");
  });
});

describe('saved discovery cadence', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');
  it('calculates daily and weekly due dates while leaving manual searches unscheduled', () => {
    expect(nextDiscoveryRun('DAILY', now)?.toISOString()).toBe('2026-07-16T12:00:00.000Z');
    expect(nextDiscoveryRun('WEEKLY', now)?.toISOString()).toBe('2026-07-22T12:00:00.000Z');
    expect(nextDiscoveryRun('MANUAL', now)).toBeNull();
  });
});
