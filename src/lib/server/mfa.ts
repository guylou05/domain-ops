import { prisma } from '@/lib/prisma';
import { decryptCredential, encryptCredential } from '@/lib/credential-crypto';
import {
  createMfaProvisioningUri,
  createMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotpCode,
} from '@/lib/mfa-policy';

function encryptionContext(userId: string): string {
  return `domainscout:user:${userId}:mfa`;
}

function masterKey(): string {
  return process.env.ENCRYPTION_KEY ?? '';
}

function encryptSecret(userId: string, secret: string): string {
  return encryptCredential(secret, masterKey(), encryptionContext(userId));
}

function decryptSecret(userId: string, encrypted: string): string {
  return decryptCredential(encrypted, masterKey(), encryptionContext(userId));
}

export async function beginMfaEnrollment(userId: string, email: string): Promise<{ secret: string; provisioningUri: string }> {
  const secret = createMfaSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { mfaPendingSecretEncrypted: encryptSecret(userId, secret) },
  });
  return { secret, provisioningUri: createMfaProvisioningUri(email, secret) };
}

export async function completeMfaEnrollment(userId: string, code: string): Promise<string[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaPendingSecretEncrypted: true },
  });
  if (!user?.mfaPendingSecretEncrypted) return null;
  const secret = decryptSecret(userId, user.mfaPendingSecretEncrypted);
  if (!verifyTotpCode(secret, code)) return null;

  const recoveryCodes = generateRecoveryCodes();
  const now = new Date();
  const completed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: userId, mfaEnabledAt: null, mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted },
      data: { mfaEnabledAt: now, mfaSecretEncrypted: encryptSecret(userId, secret), mfaPendingSecretEncrypted: null },
    });
    if (claimed.count !== 1) return false;
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((recoveryCode) => ({ userId, codeHash: hashRecoveryCode(recoveryCode) })) });
    return true;
  });
  return completed ? recoveryCodes : null;
}

export async function verifyMfaChallenge(userId: string, code: string, consumeRecovery = true): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabledAt: true, mfaSecretEncrypted: true },
  });
  if (!user?.mfaEnabledAt || !user.mfaSecretEncrypted) return false;

  const secret = decryptSecret(userId, user.mfaSecretEncrypted);
  if (verifyTotpCode(secret, code)) return true;

  const codeHash = hashRecoveryCode(code);
  if (!consumeRecovery) {
    return Boolean(await prisma.mfaRecoveryCode.findFirst({ where: { userId, codeHash, usedAt: null }, select: { id: true } }));
  }
  const consumed = await prisma.mfaRecoveryCode.updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: new Date() } });
  return consumed.count === 1;
}

export async function replaceMfaRecoveryCodes(userId: string): Promise<string[]> {
  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.createMany({ data: recoveryCodes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })) }),
  ]);
  return recoveryCodes;
}

export async function disableMfa(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { mfaEnabledAt: null, mfaSecretEncrypted: null, mfaPendingSecretEncrypted: null },
    }),
  ]);
}
