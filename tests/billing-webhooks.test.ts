import { describe, expect, it } from 'vitest';
import { parseStripeWebhookEvent, stripeEventWorkspaceId } from '../src/lib/billing-webhook-policy';

describe('billing webhook policy', () => {
  it('extracts workspace reconciliation metadata from subscription events', () => {
    const event = parseStripeWebhookEvent({
      id: 'evt_subscription',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1', metadata: { workspaceId: 'workspace-1', subscriptionId: 'internal-1' } } },
    });
    expect(event).not.toBeNull();
    expect(stripeEventWorkspaceId(event!)).toBe('workspace-1');
  });

  it('falls back to Checkout client references and rejects malformed events', () => {
    const event = parseStripeWebhookEvent({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'workspace-2' } },
    });
    expect(stripeEventWorkspaceId(event!)).toBe('workspace-2');
    expect(parseStripeWebhookEvent({ type: 'missing-id' })).toBeNull();
  });
});
