import { describe, expect, it } from 'vitest';
import {
  TRIAL_DURATION_DAYS,
  subscriptionAllowsUsage,
  subscriptionDisplayStatus,
  trialEndsAt,
  workspaceSlugFromEmail,
} from '../src/lib/onboarding-policy';

describe('workspace onboarding policy', () => {
  it('creates stable, collision-resistant slugs from normalized emails', () => {
    expect(workspaceSlugFromEmail(' Founder+Ops@Example.com ')).toBe(workspaceSlugFromEmail('founder+ops@example.com'));
    expect(workspaceSlugFromEmail('founder@example.com')).not.toBe(workspaceSlugFromEmail('founder@another.example'));
    expect(workspaceSlugFromEmail('Founder+Ops@Example.com')).toMatch(/^founder-ops-[a-f0-9]{8}$/);
  });

  it('creates an exact fourteen-day trial', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    expect(trialEndsAt(now).getTime() - now.getTime()).toBe(TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  });

  it('fails closed for missing or expired trial dates', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const future = new Date('2026-07-15T12:00:00.000Z');
    expect(subscriptionAllowsUsage('ACTIVE', null, now)).toBe(true);
    expect(subscriptionAllowsUsage('TRIALING', future, now)).toBe(true);
    expect(subscriptionAllowsUsage('TRIALING', null, now)).toBe(false);
    expect(subscriptionAllowsUsage('TRIALING', now, now)).toBe(false);
    expect(subscriptionAllowsUsage('CANCELLED', future, now)).toBe(false);
    expect(subscriptionDisplayStatus('TRIALING', now, now)).toBe('TRIAL_EXPIRED');
  });
});
