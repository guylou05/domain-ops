import { createHash, randomBytes } from 'node:crypto';

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function createEmailVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashEmailVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function emailVerificationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);
}

export function emailVerificationIsUsable(
  verification: { usedAt: Date | null; expiresAt: Date },
  now = new Date(),
): boolean {
  return !verification.usedAt && verification.expiresAt.getTime() > now.getTime();
}

export function emailVerificationCanResend(createdAt: Date | null, now = new Date()): boolean {
  return !createdAt || now.getTime() - createdAt.getTime() >= EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
}
