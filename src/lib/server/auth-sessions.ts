import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { authSessionExpiresAt, isRecentStepUp } from '@/lib/mfa-policy';

export async function createTrackedAuthSession(userId: string, provider: string, mfaAuthenticated: boolean): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await prisma.authSession.create({
    data: {
      id,
      userId,
      provider,
      expiresAt: authSessionExpiresAt(now),
      mfaAuthenticatedAt: mfaAuthenticated ? now : null,
      stepUpAt: mfaAuthenticated ? now : null,
    },
  });
  return id;
}

export async function getActiveAuthSession(id: string, userId: string) {
  const now = new Date();
  const session = await prisma.authSession.findFirst({
    where: { id, userId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, lastSeenAt: true, mfaAuthenticatedAt: true, stepUpAt: true },
  });
  if (session && session.lastSeenAt.getTime() < now.getTime() - 5 * 60 * 1000) {
    await prisma.authSession.updateMany({ where: { id, revokedAt: null }, data: { lastSeenAt: now } });
  }
  return session;
}

export async function revokeAuthSession(id: string, userId?: string): Promise<boolean> {
  const result = await prisma.authSession.updateMany({ where: { id, ...(userId ? { userId } : {}), revokedAt: null }, data: { revokedAt: new Date() } });
  return result.count === 1;
}

export async function revokeOtherAuthSessions(userId: string, currentSessionId?: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function markSessionMfaAuthenticated(id: string, userId: string): Promise<void> {
  const now = new Date();
  await prisma.authSession.updateMany({
    where: { id, userId, revokedAt: null, expiresAt: { gt: now } },
    data: { mfaAuthenticatedAt: now, stepUpAt: now, lastSeenAt: now },
  });
}

export async function markSessionStepUp(id: string, userId: string): Promise<void> {
  await prisma.authSession.updateMany({ where: { id, userId, revokedAt: null }, data: { stepUpAt: new Date() } });
}

export function authSessionHasRecentStepUp(stepUpAt: Date | null): boolean {
  return isRecentStepUp(stepUpAt);
}
