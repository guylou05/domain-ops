import { describe, expect, it } from 'vitest';
import * as OTPAuth from 'otpauth';
import {
  authSessionExpiresAt,
  createMfaProvisioningUri,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecentStepUp,
  normalizeRecoveryCode,
  verifyTotpCode,
} from '../src/lib/mfa-policy';

describe('MFA policy', () => {
  const secret = 'JBSWY3DPEHPK3PXP';

  it('creates and validates interoperable TOTP codes', () => {
    const now = 1_800_000_000_000;
    const totp = new OTPAuth.TOTP({ secret, digits: 6, period: 30 });
    expect(verifyTotpCode(secret, totp.generate({ timestamp: now }), now)).toBe(true);
    expect(verifyTotpCode(secret, '12345', now)).toBe(false);
    expect(createMfaProvisioningUri('user@example.com', secret)).toContain('otpauth://totp/');
  });

  it('generates distinct, normalized recovery codes and hashes them', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(normalizeRecoveryCode(codes[0].toLowerCase())).toHaveLength(16);
    expect(hashRecoveryCode(codes[0])).toBe(hashRecoveryCode(codes[0].replaceAll('-', '').toLowerCase()));
  });

  it('expires step-up authorization and tracked sessions independently', () => {
    const now = new Date('2026-07-15T00:00:00Z');
    expect(isRecentStepUp(new Date(now.getTime() - 9 * 60 * 1000), now)).toBe(true);
    expect(isRecentStepUp(new Date(now.getTime() - 11 * 60 * 1000), now)).toBe(false);
    expect(authSessionExpiresAt(now).getTime()).toBeGreaterThan(now.getTime());
  });
});
