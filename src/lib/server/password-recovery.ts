import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiresAt,
  passwordResetIsUsable,
} from '@/lib/password-reset-policy';
import { sendTransactionalEmail } from '@/lib/providers/transactional-email';
import { getAppConfig } from './app-config';
import { resolveProviderCredential } from './provider-credentials';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export async function issuePasswordResetToken(userId: string): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = createPasswordResetToken();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
          const reset = await tx.passwordResetToken.create({
            data: { userId, tokenHash: hashPasswordResetToken(token), expiresAt: passwordResetExpiresAt(now) },
            select: { id: true, expiresAt: true },
          });
          return { ...reset, token };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Unable to issue password reset after repeated transaction conflicts.');
}

export async function sendPasswordResetEmail(email: string, baseUrl: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      memberships: {
        where: { workspace: { status: 'ACTIVE' } },
        orderBy: { createdAt: 'asc' },
        select: { workspaceId: true },
      },
    },
  });
  if (!user || user.memberships.length === 0) return false;

  const config = await getAppConfig();
  let workspaceId: string | undefined;
  let apiKey: string | undefined;
  for (const membership of user.memberships) {
    const candidate = await resolveProviderCredential(membership.workspaceId, 'transactional_email');
    if (candidate) {
      workspaceId = membership.workspaceId;
      apiKey = candidate;
      break;
    }
  }
  if (!config.transactionalEmail.enabled || !config.transactionalEmail.sender || !apiKey) return false;

  const recentReset = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
    select: { id: true },
  });
  if (recentReset) return true;

  const reset = await issuePasswordResetToken(user.id);
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password/${reset.token}`;
  try {
    const providerId = await sendTransactionalEmail(config.transactionalEmail.endpoint, apiKey, {
      to: email,
      from: config.transactionalEmail.sender,
      subject: 'Reset your DomainScout AI password',
      html: `<p>A password reset was requested for your DomainScout AI account.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in one hour.</p>`,
      text: `Reset your DomainScout AI password: ${resetUrl}\n\nThis link expires in one hour.`,
      idempotencyKey: reset.id,
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: workspaceId!,
        actorId: user.id,
        action: 'password_reset.email_sent',
        targetType: 'User',
        targetId: user.id,
        metadata: { provider: 'resend', providerId },
      },
    });
    return true;
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({ where: { id: reset.id } });
    throw error;
  }
}

export async function getPasswordResetView(token: string) {
  if (!token) return null;
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashPasswordResetToken(token) },
    select: { expiresAt: true, usedAt: true, user: { select: { email: true } } },
  });
  if (!reset) return null;
  return { email: reset.user.email, expiresAt: reset.expiresAt, usable: passwordResetIsUsable(reset) };
}

export async function consumePasswordResetToken(token: string, passwordHash: string): Promise<boolean> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const reset = await tx.passwordResetToken.findUnique({
          where: { tokenHash: hashPasswordResetToken(token) },
          select: { id: true, userId: true, expiresAt: true, usedAt: true },
        });
        if (!reset || !passwordResetIsUsable(reset)) return false;
        const now = new Date();
        await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, emailVerified: now } });
        await tx.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return false;
    throw error;
  }
}
