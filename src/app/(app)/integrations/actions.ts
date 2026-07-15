'use server';

import { Status } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import {
  isManagedProviderKey,
  removeProviderCredential as removeStoredProviderCredential,
  saveProviderCredential as saveStoredProviderCredential,
} from '@/lib/server/provider-credentials';
import { assertVerifiedUser, assertWorkspaceAdmin, assertWorkspaceWriter, requireRecentStepUp, requireWorkspaceContext } from '@/lib/server/workspace-context';
import { getAppConfig } from '@/lib/server/app-config';
import { getAvailabilityProvider } from '@/lib/providers/availability';
import { getComparableSalesProvider } from '@/lib/providers/comparable-sales';
import { getTrademarkProvider } from '@/lib/providers/trademark';
import { getHistoryProvider } from '@/lib/providers/history';
import { getPublicBusinessProvider } from '@/lib/providers/public-business';
import { resolveProviderCredential } from '@/lib/server/provider-credentials';

function readIntegrationId(formData: FormData): string {
  const id = String(formData.get('integrationId') ?? '').trim();
  if (!id) throw new Error('integrationId is required.');
  return id;
}

export async function toggleIntegrationStatus(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/integrations');

  const integrationId = readIntegrationId(formData);
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      workspaceId: context.workspaceId,
    },
    select: {
      id: true,
      provider: true,
      status: true,
    },
  });

  if (!integration) throw new Error('Integration was not found in this workspace.');

  const status = integration.status === Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
  await prisma.integration.update({
    where: { id: integration.id },
    data: { status },
  });

  await recordAuditEvent(context, {
    action: 'integration.status_toggled',
    targetType: 'Integration',
    targetId: integration.id,
    metadata: { provider: integration.provider, status },
  });

  revalidatePath('/integrations');
  revalidatePath('/admin');
  revalidatePath('/settings');
}

function readProvider(formData: FormData) {
  const provider = String(formData.get('provider') ?? '').trim();
  if (!isManagedProviderKey(provider)) throw new Error('Unsupported provider credential.');
  return provider;
}

export async function saveProviderCredential(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/integrations');
  const provider = readProvider(formData);
  const secret = String(formData.get('secret') ?? '').trim();
  if (secret.length < 8) throw new Error('Provider API keys must contain at least 8 characters.');

  await saveStoredProviderCredential(context.workspaceId, provider, secret);
  await recordAuditEvent(context, {
    action: 'provider_credential.saved',
    targetType: 'ApiCredential',
    targetId: provider,
    metadata: { provider },
  });
  revalidatePath('/integrations');
}

export async function removeProviderCredential(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  assertVerifiedUser(context);
  requireRecentStepUp(context, '/integrations');
  const provider = readProvider(formData);
  await removeStoredProviderCredential(context.workspaceId, provider);
  await recordAuditEvent(context, {
    action: 'provider_credential.removed',
    targetType: 'ApiCredential',
    targetId: provider,
    metadata: { provider },
  });
  revalidatePath('/integrations');
}

export async function testProviderConnection(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext(); assertWorkspaceAdmin(context); assertVerifiedUser(context); requireRecentStepUp(context, '/integrations');
  const provider = String(formData.get('provider') ?? ''); const config = await getAppConfig(); const domain = 'domainscout-smoke-test.com';
  if (provider === 'registrar' && config.availabilityProvider === 'live') await getAvailabilityProvider(config.availabilityProvider, config.providerEndpoints.registrar, await resolveProviderCredential(context.workspaceId, 'registrar'), config.registrarAdapter).check(domain);
  else if (provider === 'trademark' && config.trademarkProvider === 'live') await getTrademarkProvider(config.trademarkProvider, config.providerEndpoints.trademark, await resolveProviderCredential(context.workspaceId, 'trademark')).check(domain);
  else if (provider === 'comparableSales' && config.comparableSalesProvider === 'live') await getComparableSalesProvider(config.comparableSalesProvider, config.providerEndpoints.comparableSales, await resolveProviderCredential(context.workspaceId, 'comparable_sales')).search(domain);
  else if (provider === 'history' && config.historyProvider === 'live') await getHistoryProvider(config.historyProvider, config.providerEndpoints.history, await resolveProviderCredential(context.workspaceId, 'domain_history')).check(domain, 75);
  else if (provider === 'publicBusiness' && config.publicBusinessProvider === 'live') await getPublicBusinessProvider(config.publicBusinessProvider, config.providerEndpoints.publicBusiness, config.publicBusinessContact).search(domain);
  else throw new Error('Unsupported provider smoke check.');
  await recordAuditEvent(context, { action: 'provider.smoke_check_passed', targetType: 'Integration', targetId: provider, metadata: { mode: 'live' } });
  revalidatePath('/integrations');
}
