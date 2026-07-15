import { createHmac, timingSafeEqual } from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com';

export class BillingProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'BillingProviderError';
  }
}

type StripeSession = { id: string; url: string | null };

async function stripePost(
  secret: string,
  path: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<StripeSession> {
  const response = await fetchImpl(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: unknown; url?: unknown; error?: { message?: unknown } };
  if (!response.ok) {
    const message = typeof payload.error?.message === 'string' ? payload.error.message : `Stripe returned HTTP ${response.status}.`;
    throw new BillingProviderError(message, response.status);
  }
  if (typeof payload.id !== 'string' || (payload.url !== null && typeof payload.url !== 'string')) {
    throw new BillingProviderError('Stripe returned an invalid session response.');
  }
  return { id: payload.id, url: payload.url ?? null };
}

export async function createStripeCheckoutSession(input: {
  secret: string;
  workspaceId: string;
  subscriptionId: string;
  planName: string;
  priceCents: number;
  currency: string;
  email: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}, fetchImpl: typeof fetch = fetch): Promise<StripeSession> {
  const customer: Record<string, string> = input.customerId ? { customer: input.customerId } : { customer_email: input.email };
  return stripePost(input.secret, '/v1/checkout/sessions', {
    mode: 'subscription',
    client_reference_id: input.workspaceId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: 'true',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': input.currency,
    'line_items[0][price_data][unit_amount]': String(input.priceCents),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': input.planName,
    'metadata[workspaceId]': input.workspaceId,
    'metadata[subscriptionId]': input.subscriptionId,
    'subscription_data[metadata][workspaceId]': input.workspaceId,
    'subscription_data[metadata][subscriptionId]': input.subscriptionId,
    ...customer,
  }, fetchImpl);
}

export async function createStripePortalSession(input: {
  secret: string;
  customerId: string;
  returnUrl: string;
}, fetchImpl: typeof fetch = fetch): Promise<StripeSession> {
  return stripePost(input.secret, '/v1/billing_portal/sessions', {
    customer: input.customerId,
    return_url: input.returnUrl,
  }, fetchImpl);
}

export function verifyStripeSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',').map((part) => part.trim().split('=', 2));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds || signatures.length === 0) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const signatureBuffer = Buffer.from(signature, 'hex');
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  });
}

export function normalizeStripeSubscriptionStatus(status: unknown): string {
  switch (status) {
    case 'active': return 'ACTIVE';
    case 'trialing': return 'TRIALING';
    case 'past_due': return 'PAST_DUE';
    case 'unpaid': return 'UNPAID';
    case 'canceled': return 'CANCELLED';
    case 'paused': return 'PAUSED';
    default: return 'INCOMPLETE';
  }
}

export function stripeTimestamp(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
}
