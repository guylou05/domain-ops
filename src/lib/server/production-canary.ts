import { hash } from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const CANARY_NAME = 'DomainScout Production Canary';
const CANARY_EMAIL = 'production-canary@domainscout.invalid';
const CANARY_WORKSPACE = 'demo-domain-portfolio';

export async function rotateProductionCanary(password: string): Promise<void> {
  if (password.length < 24) throw new Error('Canary password is too short.');
  const email = (process.env.CANARY_EMAIL || CANARY_EMAIL).trim().toLowerCase();
  const workspaceSlug = (process.env.CANARY_WORKSPACE_SLUG || process.env.DEMO_WORKSPACE_SLUG || CANARY_WORKSPACE).trim();
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug }, select: { id: true, status: true } });
  if (!workspace || workspace.status !== 'ACTIVE') throw new Error('Active canary workspace was not found.');

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, accounts: { select: { id: true } }, memberships: { select: { workspaceId: true } } },
  });
  if (existing?.name !== undefined && existing.name !== CANARY_NAME) throw new Error('Refusing to repurpose an existing non-canary account.');
  if (existing?.accounts.length) throw new Error('Canary account must not have linked OAuth accounts.');
  if (existing?.memberships.some((membership) => membership.workspaceId !== workspace.id)) throw new Error('Canary account must not belong to another workspace.');

  const passwordHash = await hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: { email, name: CANARY_NAME, passwordHash, role: Role.VIEWER, emailVerified: new Date() },
      update: {
        name: CANARY_NAME,
        passwordHash,
        role: Role.VIEWER,
        emailVerified: new Date(),
        mfaEnabledAt: null,
        mfaSecretEncrypted: null,
        mfaPendingSecretEncrypted: null,
      },
      select: { id: true },
    });
    await tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      create: { workspaceId: workspace.id, userId: user.id, role: Role.VIEWER },
      update: { role: Role.VIEWER },
    });
    await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}
