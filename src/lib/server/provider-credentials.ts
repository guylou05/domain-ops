import { prisma } from '@/lib/prisma';
import { decryptCredential, encryptCredential } from '@/lib/credential-crypto';

export const MANAGED_PROVIDER_CREDENTIALS = [
  { key: 'registrar', label: 'Registrar availability', envName: 'REGISTRAR_API_KEY' },
  { key: 'trademark', label: 'Trademark screening', envName: 'TRADEMARK_API_KEY' },
  { key: 'comparable_sales', label: 'Comparable sales', envName: 'COMPARABLE_SALES_API_KEY' },
  { key: 'domain_history', label: 'Domain history', envName: 'DOMAIN_HISTORY_API_KEY' },
  { key: 'transactional_email', label: 'Transactional email', envName: 'EMAIL_API_KEY' },
  { key: 'stripe_secret_key', label: 'Stripe secret key', envName: 'STRIPE_SECRET_KEY' },
  { key: 'stripe_webhook_secret', label: 'Stripe webhook secret', envName: 'STRIPE_WEBHOOK_SECRET' },
] as const;

export type ManagedProviderKey = (typeof MANAGED_PROVIDER_CREDENTIALS)[number]['key'];

export function isManagedProviderKey(value: string): value is ManagedProviderKey {
  return MANAGED_PROVIDER_CREDENTIALS.some((provider) => provider.key === value);
}

function encryptionContext(workspaceId: string, provider: ManagedProviderKey): string {
  return `domainscout:${workspaceId}:${provider}`;
}

function masterKey(): string {
  return process.env.ENCRYPTION_KEY ?? '';
}

export async function saveProviderCredential(workspaceId: string, provider: ManagedProviderKey, secret: string): Promise<void> {
  const encryptedSecret = encryptCredential(secret, masterKey(), encryptionContext(workspaceId, provider));
  await prisma.apiCredential.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    update: { encryptedSecret },
    create: { workspaceId, provider, encryptedSecret },
  });
}

export async function removeProviderCredential(workspaceId: string, provider: ManagedProviderKey): Promise<void> {
  await prisma.apiCredential.deleteMany({ where: { workspaceId, provider } });
}

export async function resolveProviderCredential(workspaceId: string, provider: ManagedProviderKey): Promise<string | undefined> {
  const credential = await prisma.apiCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
    select: { encryptedSecret: true },
  });
  if (credential) {
    try {
      return decryptCredential(credential.encryptedSecret, masterKey(), encryptionContext(workspaceId, provider));
    } catch {
      // Legacy or key-mismatched records fall back to deployment secrets until rotated in the UI.
    }
  }
  const definition = MANAGED_PROVIDER_CREDENTIALS.find((item) => item.key === provider);
  return definition ? process.env[definition.envName] || undefined : undefined;
}
