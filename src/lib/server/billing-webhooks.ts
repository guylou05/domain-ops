import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeStripeSubscriptionStatus, stripeTimestamp } from '@/lib/providers/stripe-billing';
import type { StripeWebhookEvent } from '@/lib/billing-webhook-policy';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export async function processStripeWebhookEvent(event: StripeWebhookEvent, workspaceId: string): Promise<'processed' | 'duplicate'> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.billingEvent.create({
        data: { workspaceId, provider: 'stripe', providerEventId: event.id, type: event.type },
      });

      const object = event.data.object;
      const internalSubscriptionId = readString(object.metadata?.subscriptionId);
      const externalSubscriptionId = event.type === 'checkout.session.completed'
        ? readString(object.subscription)
        : readString(object.id);
      const externalCustomerId = readString(object.customer);
      const subscriptionWhere = internalSubscriptionId
        ? { id: internalSubscriptionId, workspaceId }
        : externalSubscriptionId
          ? { externalSubscriptionId, workspaceId }
          : null;

      if (subscriptionWhere && event.type === 'checkout.session.completed') {
        const paid = object.payment_status === 'paid' || object.payment_status === 'no_payment_required';
        await tx.subscription.updateMany({
          where: subscriptionWhere,
          data: {
            provider: 'STRIPE',
            externalCustomerId,
            externalSubscriptionId,
            status: paid ? 'ACTIVE' : 'INCOMPLETE',
            trialEndsAt: null,
          },
        });
      } else if (subscriptionWhere && event.type.startsWith('customer.subscription.')) {
        await tx.subscription.updateMany({
          where: subscriptionWhere,
          data: {
            provider: 'STRIPE',
            externalCustomerId,
            externalSubscriptionId,
            status: event.type === 'customer.subscription.deleted' ? 'CANCELLED' : normalizeStripeSubscriptionStatus(object.status),
            currentPeriodEnd: stripeTimestamp(object.current_period_end),
            cancelAtPeriodEnd: object.cancel_at_period_end === true,
            trialEndsAt: object.status === 'trialing' ? stripeTimestamp(object.current_period_end) : null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId,
          action: 'billing.webhook_processed',
          targetType: 'BillingEvent',
          targetId: event.id,
          metadata: { provider: 'stripe', type: event.type },
        },
      });
      await tx.billingEvent.update({ where: { providerEventId: event.id }, data: { processedAt: new Date() } });
      return 'processed' as const;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.billingEvent.findUnique({ where: { providerEventId: event.id }, select: { id: true } });
      if (existing) return 'duplicate';
    }
    throw error;
  }
}
