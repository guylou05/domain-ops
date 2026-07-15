import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/providers/stripe-billing';
import { parseStripeWebhookEvent, stripeEventWorkspaceId } from '@/lib/billing-webhook-policy';
import { processStripeWebhookEvent } from '@/lib/server/billing-webhooks';
import { resolveProviderCredential } from '@/lib/server/provider-credentials';
import { safeRecordOperationalEvent } from '@/lib/server/observability';

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const recordRequest = (status: number, message: string, workspaceId?: string) => safeRecordOperationalEvent({
    workspaceId: workspaceId ?? null,
    source: 'request',
    level: status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO',
    outcome: status >= 500 ? 'FAILURE' : 'SUCCESS',
    event: 'request.stripe_webhook',
    message,
    correlationId: requestId,
    durationMs: Date.now() - startedAt,
    metadata: { method: 'POST', path: '/api/billing/stripe', status },
  });
  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    await recordRequest(400, 'Rejected invalid JSON.');
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }
  const event = parseStripeWebhookEvent(parsed);
  if (!event) {
    await recordRequest(400, 'Rejected invalid Stripe event.');
    return NextResponse.json({ ok: false, error: 'Invalid Stripe event.' }, { status: 400 });
  }
  const workspaceId = stripeEventWorkspaceId(event);
  if (!workspaceId) {
    await recordRequest(400, 'Rejected Stripe event without workspace metadata.');
    return NextResponse.json({ ok: false, error: 'Workspace metadata is required.' }, { status: 400 });
  }

  const secret = await resolveProviderCredential(workspaceId, 'stripe_webhook_secret');
  if (!secret || !verifyStripeSignature(body, request.headers.get('stripe-signature'), secret)) {
    await recordRequest(400, 'Rejected Stripe event with invalid signature.', workspaceId);
    return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    const result = await processStripeWebhookEvent(event, workspaceId);
    await Promise.all([
      recordRequest(200, 'Stripe webhook request completed.', workspaceId),
      safeRecordOperationalEvent({ workspaceId, source: 'webhook', level: 'INFO', outcome: 'SUCCESS', event: `webhook.${event.type}`, message: `Stripe webhook ${result}.`, correlationId: event.id, durationMs: Date.now() - startedAt, metadata: { provider: 'stripe', result } }),
    ]);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe webhook processing failed.';
    await Promise.all([
      recordRequest(500, message, workspaceId),
      safeRecordOperationalEvent({ workspaceId, source: 'webhook', level: 'ERROR', outcome: 'FAILURE', event: `webhook.${event.type}`, message, correlationId: event.id, durationMs: Date.now() - startedAt, metadata: { provider: 'stripe' } }),
    ]);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}
