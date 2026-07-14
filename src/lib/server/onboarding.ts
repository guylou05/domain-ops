import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { trialEndsAt, workspaceSlugFromEmail } from '@/lib/onboarding-policy';

export type ProvisionWorkspaceInput = {
  email: string;
  name: string | null;
  passwordHash: string;
  planName: string;
};

export class OnboardingError extends Error {
  constructor(
    public readonly code: 'ACCOUNT_EXISTS' | 'PLAN_UNAVAILABLE' | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

export async function provisionTrialWorkspace(input: ProvisionWorkspaceInput): Promise<{ userId: string; workspaceId: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const plan = await tx.plan.findUnique({ where: { name: input.planName }, select: { id: true } });
          if (!plan) throw new OnboardingError('PLAN_UNAVAILABLE', 'The selected plan is not available.');

          const existingUser = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
          if (existingUser) throw new OnboardingError('ACCOUNT_EXISTS', 'An account already exists for that email.');

          const user = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              passwordHash: input.passwordHash,
              role: 'OWNER',
              memberships: {
                create: {
                  role: 'OWNER',
                  workspace: {
                    create: {
                      name: input.name ? `${input.name}'s Workspace` : 'New Workspace',
                      slug: workspaceSlugFromEmail(input.email),
                    },
                  },
                },
              },
            },
            select: { id: true, memberships: { select: { workspaceId: true }, take: 1 } },
          });
          const workspaceId = user.memberships[0]?.workspaceId;
          if (!workspaceId) throw new OnboardingError('CONFLICT', 'The workspace could not be provisioned.');

          await tx.subscription.create({
            data: {
              workspaceId,
              planId: plan.id,
              status: 'TRIALING',
              trialEndsAt: trialEndsAt(),
            },
          });
          await tx.auditLog.create({
            data: {
              workspaceId,
              actorId: user.id,
              action: 'workspace.provisioned',
              targetType: 'Workspace',
              targetId: workspaceId,
              metadata: { planName: input.planName, subscriptionStatus: 'TRIALING' },
            },
          });

          return { userId: user.id, workspaceId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof OnboardingError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034' && attempt < 2) continue;
        if (error.code === 'P2002') throw new OnboardingError('ACCOUNT_EXISTS', 'An account already exists for that email.');
      }
      throw error;
    }
  }
  throw new OnboardingError('CONFLICT', 'The workspace could not be provisioned after repeated conflicts.');
}
