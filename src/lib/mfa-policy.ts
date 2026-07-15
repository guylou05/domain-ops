import { createHash, randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';

export const MFA_ISSUER = 'DomainScout AI';
export const STEP_UP_TTL_MS = 10 * 60 * 1000;
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createMfaSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function createMfaProvisioningUri(email: string, secret: string): string {
  return new OTPAuth.TOTP({ issuer: MFA_ISSUER, label: email, algorithm: 'SHA1', digits: 6, period: 30, secret }).toString();
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()): boolean {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const totp = new OTPAuth.TOTP({ issuer: MFA_ISSUER, label: 'account', algorithm: 'SHA1', digits: 6, period: 30, secret });
  return totp.validate({ token: normalized, timestamp: now, window: 1 }) !== null;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-'));
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

export function isRecentStepUp(stepUpAt: Date | null, now = new Date()): boolean {
  return Boolean(stepUpAt && now.getTime() - stepUpAt.getTime() <= STEP_UP_TTL_MS);
}

export function authSessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + AUTH_SESSION_TTL_MS);
}
