import { describe, expect, it } from 'vitest';
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  createEmailVerificationToken,
  emailVerificationCanResend,
  emailVerificationExpiresAt,
  emailVerificationIsUsable,
  hashEmailVerificationToken,
} from '../src/lib/email-verification-policy';

describe('email verification policy', () => {
  it('creates opaque tokens and stores deterministic hashes', () => {
    const token = createEmailVerificationToken();
    expect(token.length).toBeGreaterThan(32);
    expect(hashEmailVerificationToken(token)).toHaveLength(64);
    expect(hashEmailVerificationToken(token)).not.toContain(token);
  });

  it('expires tokens after 24 hours and enforces one-minute resend cooldowns', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    expect(emailVerificationExpiresAt(now).getTime() - now.getTime()).toBe(EMAIL_VERIFICATION_TTL_MS);
    expect(emailVerificationIsUsable({ usedAt: null, expiresAt: new Date(now.getTime() + 1) }, now)).toBe(true);
    expect(emailVerificationIsUsable({ usedAt: now, expiresAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(emailVerificationCanResend(new Date(now.getTime() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS), now)).toBe(true);
    expect(emailVerificationCanResend(new Date(now.getTime() - 10_000), now)).toBe(false);
  });
});
