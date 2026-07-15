import { prisma } from '@/lib/prisma';
import { getAvailabilityProviderStatus } from '@/lib/providers/availability';
import { getComparableSalesProviderStatus } from '@/lib/providers/comparable-sales';
import { getHistoryProviderStatus } from '@/lib/providers/history';
import { getTrademarkProviderStatus } from '@/lib/providers/trademark';
import { getAppConfig } from './app-config';
import { MANAGED_PROVIDER_CREDENTIALS, resolveProviderCredential } from './provider-credentials';
import { requireWorkspaceContext } from './workspace-context';

export type IntegrationView = {
  id: string;
  provider: string;
  status: string;
  configured: boolean;
  credentialCreatedAt: Date | null;
  mode: string;
  description: string;
  featureFlag: {
    key: string;
    enabled: boolean;
  } | null;
};

type IntegrationConfig = {
  mode?: unknown;
  description?: unknown;
  featureFlag?: unknown;
};

function readConfig(value: unknown): IntegrationConfig {
  return value && typeof value === 'object' ? (value as IntegrationConfig) : {};
}

function formatProvider(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export async function getIntegrations(): Promise<IntegrationView[]> {
  const context = await requireWorkspaceContext();

  const [integrations, credentials, flags] = await Promise.all([
    prisma.integration.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { provider: 'asc' },
    }),
    prisma.apiCredential.findMany({
      where: { workspaceId: context.workspaceId },
      select: { provider: true, createdAt: true },
    }),
    prisma.featureFlag.findMany({
      select: { key: true, enabled: true },
    }),
  ]);

  const credentialByProvider = new Map(credentials.map((credential) => [credential.provider, credential]));
  const flagByKey = new Map(flags.map((flag) => [flag.key, flag]));

  return integrations.map((integration) => {
    const config = readConfig(integration.config);
    const flagKey = typeof config.featureFlag === 'string' ? config.featureFlag : null;
    const credential = credentialByProvider.get(integration.provider);

    return {
      id: integration.id,
      provider: formatProvider(integration.provider),
      status: integration.status,
      configured: Boolean(credential),
      credentialCreatedAt: credential?.createdAt ?? null,
      mode: typeof config.mode === 'string' ? config.mode : 'mock',
      description: typeof config.description === 'string' ? config.description : 'No integration description saved.',
      featureFlag: flagKey ? flagByKey.get(flagKey) ?? { key: flagKey, enabled: false } : null,
    };
  });
}

export async function getProviderCredentialViews() {
  const context = await requireWorkspaceContext();
  const credentials = await prisma.apiCredential.findMany({
    where: { workspaceId: context.workspaceId, provider: { in: MANAGED_PROVIDER_CREDENTIALS.map((provider) => provider.key) } },
    select: { provider: true, updatedAt: true },
  });
  const byProvider = new Map(credentials.map((credential) => [credential.provider, credential]));

  return {
    canManage: context.role === 'OWNER' || context.role === 'ADMIN',
    providers: MANAGED_PROVIDER_CREDENTIALS.map((provider) => {
      const stored = byProvider.get(provider.key);
      return {
        key: provider.key,
        label: provider.label,
        source: stored ? 'database' as const : process.env[provider.envName] ? 'environment' as const : 'missing' as const,
        updatedAt: stored?.updatedAt ?? null,
      };
    }),
  };
}

export async function getProviderRuntimeStatuses() {
  const context = await requireWorkspaceContext();
  const config = await getAppConfig();
  const [registrarKey, trademarkKey, salesKey, historyKey, emailKey, stripeKey, stripeWebhookKey] = await Promise.all([
    resolveProviderCredential(context.workspaceId, 'registrar'),
    resolveProviderCredential(context.workspaceId, 'trademark'),
    resolveProviderCredential(context.workspaceId, 'comparable_sales'),
    resolveProviderCredential(context.workspaceId, 'domain_history'),
    resolveProviderCredential(context.workspaceId, 'transactional_email'),
    resolveProviderCredential(context.workspaceId, 'stripe_secret_key'),
    resolveProviderCredential(context.workspaceId, 'stripe_webhook_secret'),
  ]);
  return [
    { key: 'registrar', ...getAvailabilityProviderStatus(config.availabilityProvider, config.providerEndpoints.registrar, registrarKey) },
    { key: 'trademark', ...getTrademarkProviderStatus(config.trademarkProvider, config.providerEndpoints.trademark, trademarkKey) },
    { key: 'comparableSales', ...getComparableSalesProviderStatus(config.comparableSalesProvider, config.providerEndpoints.comparableSales, salesKey) },
    { key: 'history', ...getHistoryProviderStatus(config.historyProvider, config.providerEndpoints.history, historyKey) },
    {
      key: 'transactionalEmail',
      label: 'Transactional email',
      mode: config.transactionalEmail.enabled ? 'live' : 'off',
      liveReady: config.transactionalEmail.enabled && Boolean(config.transactionalEmail.sender && emailKey),
    },
    {
      key: 'stripeBilling',
      label: 'Stripe billing',
      mode: config.billing.mode,
      liveReady: config.billing.mode !== 'off' && Boolean(stripeKey && stripeWebhookKey),
    },
  ];
}
