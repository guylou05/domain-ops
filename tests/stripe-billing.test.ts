import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  normalizeStripeSubscriptionStatus,
  verifyStripeSignature,
} from '../src/lib/providers/stripe-billing';

describe('Stripe billing provider', () => {
  it('creates subscription checkout sessions with internal reconciliation metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/test' }), { status: 200 }));
    const session = await createStripeCheckoutSession({
      secret: 'sk_test_value', workspaceId: 'workspace-1', subscriptionId: 'subscription-1', planName: 'Professional',
      priceCents: 9900, currency: 'usd', email: 'owner@example.com', successUrl: 'https://app.example/settings?billing=success',
      cancelUrl: 'https://app.example/settings?billing=cancelled',
    }, fetchMock);

    expect(session.url).toBe('https://checkout.stripe.com/test');
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.get('mode')).toBe('subscription');
    expect(body.get('client_reference_id')).toBe('workspace-1');
    expect(body.get('subscription_data[metadata][subscriptionId]')).toBe('subscription-1');
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('9900');
  });

  it('creates customer portal sessions', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'bps_1', url: 'https://billing.stripe.com/session' }), { status: 200 }));
    await createStripePortalSession({ secret: 'sk_test_value', customerId: 'cus_1', returnUrl: 'https://app.example/settings' }, fetchMock);
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.get('customer')).toBe('cus_1');
  });

  it('verifies signed webhook payloads within the replay window', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const timestamp = 1_800_000_000;
    const signature = createHmac('sha256', 'whsec_test').update(`${timestamp}.${body}`).digest('hex');
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, 'whsec_test', timestamp)).toBe(true);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, 'wrong', timestamp)).toBe(false);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, 'whsec_test', timestamp + 301)).toBe(false);
  });

  it('normalizes provider subscription states into entitlement states', () => {
    expect(normalizeStripeSubscriptionStatus('active')).toBe('ACTIVE');
    expect(normalizeStripeSubscriptionStatus('past_due')).toBe('PAST_DUE');
    expect(normalizeStripeSubscriptionStatus('canceled')).toBe('CANCELLED');
    expect(normalizeStripeSubscriptionStatus('unknown')).toBe('INCOMPLETE');
  });
});
