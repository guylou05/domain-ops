import { describe, expect, it } from 'vitest';
import { assertEntitlementAvailable, EntitlementError, monthlyUsageWindow } from '../src/lib/entitlement-policy';

describe('subscription entitlement enforcement', () => {
  it('uses calendar-month UTC usage windows', () => {
    const window = monthlyUsageWindow(new Date('2026-07-31T23:59:59.000Z'));
    expect(window.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('allows usage through the exact plan limit', () => {
    expect(() => assertEntitlementAvailable({ enabled: true, limit: 100 }, 95, 5, 'domain_checks')).not.toThrow();
  });

  it('rejects usage above the plan limit', () => {
    expect(() => assertEntitlementAvailable({ enabled: true, limit: 100 }, 96, 5, 'domain_checks')).toThrowError(
      expect.objectContaining<Partial<EntitlementError>>({ code: 'QUOTA_EXCEEDED' }),
    );
  });

  it('rejects missing and disabled plan features', () => {
    expect(() => assertEntitlementAvailable(null, 0, 1, 'reports_generated')).toThrowError(
      expect.objectContaining<Partial<EntitlementError>>({ code: 'FEATURE_DISABLED' }),
    );
    expect(() => assertEntitlementAvailable({ enabled: false, limit: null }, 0, 1, 'reports_generated')).toThrow(EntitlementError);
  });
});
