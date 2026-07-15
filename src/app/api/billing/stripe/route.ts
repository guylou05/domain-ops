import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/providers/stripe-billing';
import { parseStripeWebhookEvent, stripeEventWorkspaceId } from '@/lib/billing-webhook-policy';
import { processStripeWebhookEvent } from '@/lib/server/billing-webhooks';
import { resolveProviderCredential } from '@/lib/server/provider-credentials';

export async function POST(request: Request) {
  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }
  const event = parseStripeWebhookEvent(parsed);
  if (!event) return NextResponse.json({ ok: false, error: 'Invalid Stripe event.' }, { status: 400 });
  const workspaceId = stripeEventWorkspaceId(event);
  if (!workspaceId) return NextResponse.json({ ok: false, error: 'Workspace metadata is required.' }, { status: 400 });

  const secret = await resolveProviderCredential(workspaceId, 'stripe_webhook_secret');
  if (!secret || !verifyStripeSignature(body, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 400 });
  }

  const result = await processStripeWebhookEvent(event, workspaceId);
  return NextResponse.json({ ok: true, result });
}
