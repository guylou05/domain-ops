import { prisma } from '@/lib/prisma';
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
