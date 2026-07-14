import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertEntitlementAvailable, EntitlementError, monthlyUsageWindow } from '@/lib/entitlement-policy';
import { subscriptionAllowsUsage } from '@/lib/onboarding-policy';

export { EntitlementError } from '@/lib/entitlement-policy';

export type EntitlementKey = 'domain_checks' | 'buyer_research' | 'reports_generated' | 'due_diligence_checks';

async function createUsageReservation(workspaceId: string, key: EntitlementKey, quantity: number): Promise<string> {
  const requested = Math.max(1, Math.floor(quantity));
  const window = monthlyUsageWindow();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.findFirst({
          where: { workspaceId, status: { in: ['ACTIVE', 'TRIALING'] } },
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            trialEndsAt: true,
            plan: { select: { entitlements: { where: { key }, select: { enabled: true, limit: true } } } },
          },
        });
        if (!subscription || !subscriptionAllowsUsage(subscription.status, subscription.trialEndsAt)) {
          throw new EntitlementError('SUBSCRIPTION_REQUIRED', 'An active subscription is required for this operation.');
        }

        const aggregate = await tx.usageRecord.aggregate({
          where: { workspaceId, key, createdAt: { gte: window.start, lt: window.end } },
          _sum: { quantity: true },
        });
        assertEntitlementAvailable(subscription.plan.entitlements[0] ?? null, aggregate._sum.quantity ?? 0, requested, key);
        const reservation = await tx.usageRecord.create({ data: { workspaceId, key, quantity: requested }, select: { id: true } });
        return reservation.id;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof EntitlementError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Unable to reserve usage after repeated transaction conflicts.');
}

export async function withEntitlementUsage<T>(
  workspaceId: string,
  key: EntitlementKey,
  quantity: number,
  operation: () => Promise<T>,
  actualQuantity?: (result: T) => number,
): Promise<T> {
  const reservedQuantity = Math.max(1, Math.floor(quantity));
  const reservationId = await createUsageReservation(workspaceId, key, reservedQuantity);
  try {
    const result = await operation();
    const used = Math.min(reservedQuantity, Math.max(0, Math.floor(actualQuantity?.(result) ?? reservedQuantity)));
    if (used === 0) await prisma.usageRecord.delete({ where: { id: reservationId } });
    else if (used !== reservedQuantity) await prisma.usageRecord.update({ where: { id: reservationId }, data: { quantity: used } });
    return result;
  } catch (error) {
    await prisma.usageRecord.deleteMany({ where: { id: reservationId } }).catch(() => undefined);
    throw error;
  }
}

export async function getMonthlyEntitlementUsage(workspaceId: string) {
  const window = monthlyUsageWindow();
  const subscription = await prisma.subscription.findFirst({
    where: { workspaceId, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { createdAt: 'desc' },
    include: { plan: { include: { entitlements: { orderBy: { key: 'asc' } } } } },
  });
  if (!subscription) return { periodStart: window.start, periodEnd: window.end, planName: null, entitlements: [] };
  const usage = await prisma.usageRecord.groupBy({
    by: ['key'],
    where: { workspaceId, createdAt: { gte: window.start, lt: window.end } },
    _sum: { quantity: true },
  });
  const usedByKey = new Map(usage.map((item) => [item.key, item._sum.quantity ?? 0]));
  return {
    periodStart: window.start,
    periodEnd: window.end,
    planName: subscription.plan.name,
    entitlements: subscription.plan.entitlements.map((entitlement) => ({
      key: entitlement.key,
      enabled: entitlement.enabled,
      limit: entitlement.limit,
      used: usedByKey.get(entitlement.key) ?? 0,
    })),
  };
}
