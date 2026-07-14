export class EntitlementError extends Error {
  readonly code: 'SUBSCRIPTION_REQUIRED' | 'FEATURE_DISABLED' | 'QUOTA_EXCEEDED';

  constructor(code: EntitlementError['code'], message: string) {
    super(message);
    this.name = 'EntitlementError';
    this.code = code;
  }
}

export function monthlyUsageWindow(now = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function assertEntitlementAvailable(
  entitlement: { enabled: boolean; limit: number | null } | null,
  used: number,
  requested: number,
  key: string,
): void {
  if (!entitlement || !entitlement.enabled) {
    throw new EntitlementError('FEATURE_DISABLED', `${key.replaceAll('_', ' ')} is not enabled for the current plan.`);
  }
  if (entitlement.limit !== null && used + requested > entitlement.limit) {
    throw new EntitlementError(
      'QUOTA_EXCEEDED',
      `${key.replaceAll('_', ' ')} monthly limit reached (${used}/${entitlement.limit} used).`,
    );
  }
}
