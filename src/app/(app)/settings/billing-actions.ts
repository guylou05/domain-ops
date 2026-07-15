'use server';

import { redirect } from 'next/navigation';
import { createCheckoutForWorkspace, createPortalForWorkspace } from '@/lib/server/billing';
import { recordAuditEvent } from '@/lib/server/audit';
import { assertVerifiedUser, assertWorkspaceAdmin, requireRecentStepUp, requireWorkspaceContext } from '@/lib/server/workspace-context';

function billingFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Billing is temporarily unavailable.';
  redirect(`/settings?billingError=${encodeURIComponent(message)}`);
}

export async function startSubscriptionCheckout(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/settings');
  let url: string;
  try {
    url = await createCheckoutForWorkspace(context);
  } catch (error) {
    billingFailure(error);
  }
  await recordAuditEvent(context, { action: 'billing.checkout_started', targetType: 'Workspace', targetId: context.workspaceId });
  redirect(url);
}

export async function openBillingPortal(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/settings');
  let url: string;
  try {
    url = await createPortalForWorkspace(context);
  } catch (error) {
    billingFailure(error);
  }
  await recordAuditEvent(context, { action: 'billing.portal_opened', targetType: 'Workspace', targetId: context.workspaceId });
  redirect(url);
}
