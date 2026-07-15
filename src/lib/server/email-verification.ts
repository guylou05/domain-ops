import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createEmailVerificationToken,
  emailVerificationCanResend,
  emailVerificationExpiresAt,
  emailVerificationIsUsable,
  hashEmailVerificationToken,
} from '@/lib/email-verification-policy';
import { sendTransactionalEmail } from '@/lib/providers/transactional-email';
import { getAppConfig } from './app-config';
import { resolveProviderCredential } from './provider-credentials';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export async function issueEmailVerificationToken(userId: string, workspaceId: string): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = createEmailVerificationToken();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
        const verification = await tx.emailVerificationToken.create({
          data: { userId, workspaceId, tokenHash: hashEmailVerificationToken(token), expiresAt: emailVerificationExpiresAt(now) },
          select: { id: true, expiresAt: true },
        });
        return { ...verification, token };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Unable to issue email verification after repeated transaction conflicts.');
}

export type VerificationDeliveryResult = 'sent' | 'already_verified' | 'not_configured' | 'rate_limited';

export async function sendEmailVerification(userId: string, workspaceId: string, baseUrl: string): Promise<VerificationDeliveryResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
  if (!user) throw new Error('User was not found.');
  if (user.emailVerified) return 'already_verified';

  const recent = await prisma.emailVerificationToken.findFirst({
    where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true },
  });
  if (!emailVerificationCanResend(recent?.createdAt ?? null)) return 'rate_limited';

  const [config, apiKey] = await Promise.all([
    getAppConfig(),
    resolveProviderCredential(workspaceId, 'transactional_email'),
  ]);
  if (!config.transactionalEmail.enabled || !config.transactionalEmail.sender || !apiKey) return 'not_configured';

  const verification = await issueEmailVerificationToken(userId, workspaceId);
  const verificationUrl = `${baseUrl.replace(/\/$/, '')}/verify-email/${verification.token}`;
  try {
    const providerId = await sendTransactionalEmail(config.transactionalEmail.endpoint, apiKey, {
      to: user.email,
      from: config.transactionalEmail.sender,
      subject: 'Verify your DomainScout AI email',
      html: `<p>Verify your email address to secure your DomainScout AI account.</p><p><a href="${escapeHtml(verificationUrl)}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
      text: `Verify your DomainScout AI email: ${verificationUrl}\n\nThis link expires in 24 hours.`,
      idempotencyKey: verification.id,
    });
    await prisma.auditLog.create({
      data: { workspaceId, actorId: userId, action: 'email_verification.sent', targetType: 'User', targetId: userId, metadata: { provider: 'resend', providerId } },
    });
    return 'sent';
  } catch (error) {
    await prisma.emailVerificationToken.deleteMany({ where: { id: verification.id } });
    throw error;
  }
}

export async function getEmailVerificationView(token: string) {
  if (!token) return null;
  const verification = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashEmailVerificationToken(token) },
    select: { expiresAt: true, usedAt: true, user: { select: { email: true, emailVerified: true } } },
  });
  if (!verification) return null;
  return {
    email: verification.user.email,
    verified: Boolean(verification.user.emailVerified),
    usable: emailVerificationIsUsable(verification),
  };
}

export async function consumeEmailVerificationToken(token: string): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({
        where: { tokenHash: hashEmailVerificationToken(token) },
        select: { id: true, userId: true, workspaceId: true, expiresAt: true, usedAt: true },
      });
      if (!verification || !emailVerificationIsUsable(verification)) return false;
      const now = new Date();
      await tx.user.update({ where: { id: verification.userId }, data: { emailVerified: now } });
      await tx.emailVerificationToken.updateMany({ where: { userId: verification.userId, usedAt: null }, data: { usedAt: now } });
      await tx.auditLog.create({
        data: { workspaceId: verification.workspaceId, actorId: verification.userId, action: 'email_verification.completed', targetType: 'User', targetId: verification.userId },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return false;
    throw error;
  }
}
