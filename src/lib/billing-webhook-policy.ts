export type StripeObject = {
  id?: unknown;
  customer?: unknown;
  subscription?: unknown;
  status?: unknown;
  payment_status?: unknown;
  current_period_end?: unknown;
  cancel_at_period_end?: unknown;
  client_reference_id?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: StripeObject };
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export function parseStripeWebhookEvent(value: unknown): StripeWebhookEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Partial<StripeWebhookEvent>;
  if (typeof event.id !== 'string' || typeof event.type !== 'string' || !event.data?.object) return null;
  return event as StripeWebhookEvent;
}

export function stripeEventWorkspaceId(event: StripeWebhookEvent): string | null {
  return readString(event.data.object.metadata?.workspaceId) ?? readString(event.data.object.client_reference_id);
}
