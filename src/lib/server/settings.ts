import { prisma } from '@/lib/prisma';
import { getAppConfig, type AppConfig } from './app-config';
import { getMonthlyEntitlementUsage } from './entitlements';
import { subscriptionDisplayStatus } from '@/lib/onboarding-policy';
import { requireWorkspaceContext } from './workspace-context';
import { getBillingReadiness } from './billing';

export type SettingsView = {
  workspace: {
    name: string;
    slug: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  currentUser: {
    email: string;
    name: string | null;
    role: string;
    emailVerified: Date | null;
    mfaEnabledAt: Date | null;
    recoveryCodesRemaining: number;
  };
  members: Array<{
    email: string;
    name: string | null;
    role: string;
    joinedAt: Date;
  }>;
  subscriptions: Array<{
    id: string;
    status: string;
    provider: string;
    externalCustomerId: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: Date | null;
    plan: {
      name: string;
      priceCents: number;
      entitlements: Array<{
        key: string;
        limit: number | null;
        enabled: boolean;
      }>;
    };
  }>;
  featureFlags: Array<{
    key: string;
    enabled: boolean;
    description: string | null;
  }>;
  appConfig: AppConfig;
  monthlyUsage: Awaited<ReturnType<typeof getMonthlyEntitlementUsage>>;
  billing: Awaited<ReturnType<typeof getBillingReadiness>>;
  sessions: Array<{
    id: string;
    provider: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    current: boolean;
  }>;
};

export async function getSettingsView(): Promise<SettingsView> {
  const context = await requireWorkspaceContext();

  const [workspace, currentMember, subscriptions, featureFlags, appConfig, monthlyUsage, billing, sessions, recoveryCodesRemaining] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: context.workspaceId },
      select: {
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        members: {
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: {
            role: true,
            createdAt: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    }),
    prisma.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: context.userId } },
      select: {
        role: true,
        user: { select: { email: true, name: true, emailVerified: true, mfaEnabledAt: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          include: {
            entitlements: { orderBy: { key: 'asc' } },
          },
        },
      },
    }),
    prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      select: { key: true, enabled: true, description: true },
    }),
    getAppConfig(),
    getMonthlyEntitlementUsage(context.workspaceId),
    getBillingReadiness(context.workspaceId),
    prisma.authSession.findMany({
      where: { userId: context.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, provider: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    }),
    prisma.mfaRecoveryCode.count({ where: { userId: context.userId, usedAt: null } }),
  ]);

  return {
    workspace: {
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    },
    currentUser: {
      email: currentMember.user.email,
      name: currentMember.user.name,
      role: currentMember.role,
      emailVerified: currentMember.user.emailVerified,
      mfaEnabledAt: currentMember.user.mfaEnabledAt,
      recoveryCodesRemaining,
    },
    members: workspace.members.map((member) => ({
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      joinedAt: member.createdAt,
    })),
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      status: subscriptionDisplayStatus(subscription.status, subscription.trialEndsAt),
      provider: subscription.provider,
      externalCustomerId: subscription.externalCustomerId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      plan: {
        name: subscription.plan.name,
        priceCents: subscription.plan.priceCents,
        entitlements: subscription.plan.entitlements.map((entitlement) => ({
          key: entitlement.key,
          limit: entitlement.limit,
          enabled: entitlement.enabled,
        })),
      },
    })),
    featureFlags,
    appConfig,
    monthlyUsage,
    billing,
    sessions: sessions.map((authSession) => ({ ...authSession, current: authSession.id === context.authSessionId })),
  };
}
