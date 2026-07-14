import { fetchLiveProviderJson, normalizeProviderMode, ProviderConfigurationError, type ProviderMode } from './core';

export type AvailabilityProviderMode = ProviderMode;
export { ProviderConfigurationError } from './core';

export type AvailabilityResult = {
  domain: string;
  available: boolean;
  registrationPrice: number;
  renewalPrice: number;
  premium: boolean;
  registrar: string;
  checkedAt: string;
  stale: boolean;
};

export type AvailabilityProvider = {
  mode: AvailabilityProviderMode;
  label: string;
  check(domain: string): Promise<AvailabilityResult>;
};

export async function deterministicAvailability(domain: string): Promise<AvailabilityResult> {
  const hash = [...domain].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const premium = hash % 17 === 0;
  return {
    domain,
    available: hash % 5 !== 0,
    registrationPrice: premium ? 399 : 12 + (hash % 18),
    renewalPrice: premium ? 149 : 14 + (hash % 12),
    premium,
    registrar: 'DeterministicRegistrar',
    checkedAt: new Date().toISOString(),
    stale: false,
  };
}

function deterministicProvider(mode: Extract<AvailabilityProviderMode, 'deterministic' | 'mock'>): AvailabilityProvider {
  return {
    mode,
    label: mode === 'mock' ? 'Mock registrar adapter' : 'Deterministic registrar adapter',
    check: deterministicAvailability,
  };
}

function liveProvider(endpoint?: string): AvailabilityProvider {
  return {
    mode: 'live',
    label: 'Live registrar adapter',
    async check(domain) {
      const response = await fetchLiveProviderJson({
        provider: 'Registrar',
        endpoint: endpoint || process.env.REGISTRAR_API_URL,
        apiKey: process.env.REGISTRAR_API_KEY,
        domain,
        parse(value) {
          const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
          if (typeof record.available !== 'boolean') throw new ProviderConfigurationError('Registrar response must include boolean available.');
          return {
            available: record.available,
            registrationPrice: Number(record.registrationPrice),
            renewalPrice: Number(record.renewalPrice),
            premium: record.premium === true,
            registrar: typeof record.registrar === 'string' ? record.registrar : 'LiveRegistrar',
          };
        },
      });
      if (!Number.isFinite(response.data.registrationPrice) || !Number.isFinite(response.data.renewalPrice)) {
        throw new ProviderConfigurationError('Registrar response must include numeric registrationPrice and renewalPrice.');
      }
      return { domain, ...response.data, checkedAt: response.checkedAt, stale: response.stale };
    },
  };
}

export function getAvailabilityProvider(mode = process.env.DOMAIN_PROVIDER, endpoint?: string): AvailabilityProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode === 'live') return liveProvider(endpoint);
  return deterministicProvider(providerMode);
}

export function getAvailabilityProviderStatus(mode = process.env.DOMAIN_PROVIDER, endpoint?: string): {
  mode: AvailabilityProviderMode;
  label: string;
  liveReady: boolean;
} {
  const provider = getAvailabilityProvider(mode, endpoint);
  return {
    mode: provider.mode,
    label: provider.label,
    liveReady: provider.mode !== 'live' ? true : Boolean((endpoint || process.env.REGISTRAR_API_URL) && process.env.REGISTRAR_API_KEY),
  };
}
