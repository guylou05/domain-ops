import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { assertCanaryAccountBoundary, CANARY_NAME, readCanaryIdentity } from './lib/production-canary.mjs';

if (!process.env.CANARY_PASSWORD) {
  console.log('Production canary provisioning skipped: CANARY_PASSWORD is not configured.');
  process.exit(0);
}

const identity = readCanaryIdentity();
const prisma = new PrismaClient();

try {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: identity.workspaceSlug },
    select: { id: true, status: true },
  });
  if (!workspace || workspace.status !== 'ACTIVE') throw new Error(`Active canary workspace not found: ${identity.workspaceSlug}`);

  const existing = await prisma.user.findUnique({
    where: { email: identity.email },
    select: {
      id: true,
      name: true,
      accounts: { select: { id: true } },
      memberships: { select: { workspaceId: true, role: true } },
    },
  });
  assertCanaryAccountBoundary(existing, workspace.id);

  const passwordHash = await hash(identity.password, 12);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: identity.email },
      create: {
        email: identity.email,
        name: CANARY_NAME,
        passwordHash,
        role: Role.VIEWER,
        emailVerified: new Date(),
      },
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

  console.log(`Production canary ready in ${identity.workspaceSlug} with VIEWER access.`);
} finally {
  await prisma.$disconnect();
}
