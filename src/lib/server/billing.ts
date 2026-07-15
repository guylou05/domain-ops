import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAppConfig } from '@/lib/server/app-config';
import { resolveProviderCredential } from '@/lib/server/provider-credentials';
import { createStripeCheckoutSession, createStripePortalSession } from '@/lib/providers/stripe-billing';
import type { WorkspaceContext } from '@/lib/server/workspace-context';

export async function getBillingReadiness(workspaceId: string) {
  const [config, secretKey, webhookSecret] = await Promise.all([
    getAppConfig(),
    resolveProviderCredential(workspaceId, 'stripe_secret_key'),
    resolveProviderCredential(workspaceId, 'stripe_webhook_secret'),
  ]);
  return {
    mode: config.billing.mode,
    currency: config.billing.currency,
    checkoutReady: config.billing.mode !== 'off' && Boolean(secretKey),
    webhookReady: config.billing.mode !== 'off' && Boolean(webhookSecret),
  };
}

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (host) return `${protocol}://${host}`;
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

export async function createCheckoutForWorkspace(context: WorkspaceContext): Promise<string> {
  const [config, secret, member, existingSubscription] = await Promise.all([
    getAppConfig(),
    resolveProviderCredential(context.workspaceId, 'stripe_secret_key'),
    prisma.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: context.workspaceId, userId: context.userId } },
      select: { user: { select: { email: true } } },
    }),
    prisma.subscription.findFirst({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    }),
  ]);
  if (config.billing.mode === 'off') throw new Error('Billing is disabled in Runtime settings.');
  if (!secret) throw new Error('Add the Stripe secret key in Integrations before starting checkout.');
  if (!existingSubscription) throw new Error('This workspace does not have a subscription plan.');
  if (existingSubscription.externalSubscriptionId && !['CANCELLED', 'UNPAID'].includes(existingSubscription.status)) {
    throw new Error('This workspace already has a Stripe subscription. Open billing management to change it.');
  }

  const origin = await requestOrigin();
  const session = await createStripeCheckoutSession({
    secret,
    workspaceId: context.workspaceId,
    subscriptionId: existingSubscription.id,
    planName: existingSubscription.plan.name,
    priceCents: existingSubscription.plan.priceCents,
    currency: config.billing.currency,
    email: member.user.email,
    customerId: existingSubscription.externalCustomerId,
    successUrl: `${origin}/settings?billing=checkout-complete`,
    cancelUrl: `${origin}/settings?billing=checkout-cancelled`,
  });
  if (!session.url || new URL(session.url).hostname !== 'checkout.stripe.com') throw new Error('Stripe checkout did not return a trusted redirect URL.');
  return session.url;
}

export async function createPortalForWorkspace(context: WorkspaceContext): Promise<string> {
  const [config, secret, subscription] = await Promise.all([
    getAppConfig(),
    resolveProviderCredential(context.workspaceId, 'stripe_secret_key'),
    prisma.subscription.findFirst({ where: { workspaceId: context.workspaceId }, orderBy: { createdAt: 'desc' } }),
  ]);
  if (config.billing.mode === 'off') throw new Error('Billing is disabled in Runtime settings.');
  if (!secret) throw new Error('Add the Stripe secret key in Integrations before opening billing management.');
  if (!subscription?.externalCustomerId) throw new Error('Complete checkout before opening billing management.');
  const session = await createStripePortalSession({
    secret,
    customerId: subscription.externalCustomerId,
    returnUrl: `${await requestOrigin()}/settings`,
  });
  if (!session.url || new URL(session.url).hostname !== 'billing.stripe.com') throw new Error('Stripe billing portal did not return a trusted redirect URL.');
  return session.url;
}
