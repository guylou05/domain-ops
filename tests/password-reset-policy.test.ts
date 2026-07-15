import { describe, expect, it } from 'vitest';
import {
  PASSWORD_RESET_TTL_MS,
  hashPasswordResetToken,
  passwordResetExpiresAt,
  passwordResetIsUsable,
} from '../src/lib/password-reset-policy';

describe('password reset policy', () => {
  it('hashes tokens deterministically without retaining plaintext', () => {
    const hash = hashPasswordResetToken('recovery-secret');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('recovery-secret');
    expect(hashPasswordResetToken('recovery-secret')).toBe(hash);
  });

  it('expires tokens after exactly one hour and allows one use', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const expiresAt = passwordResetExpiresAt(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(PASSWORD_RESET_TTL_MS);
    expect(passwordResetIsUsable({ usedAt: null, expiresAt }, now)).toBe(true);
    expect(passwordResetIsUsable({ usedAt: now, expiresAt }, now)).toBe(false);
    expect(passwordResetIsUsable({ usedAt: null, expiresAt: now }, now)).toBe(false);
  });
});
