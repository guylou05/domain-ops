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

function nameComProvider(endpoint?: string, apiKey?: string): AvailabilityProvider {
  return {
    mode: 'live',
    label: 'Name.com Core registrar adapter',
    async check(domain) {
      const separator = apiKey?.indexOf(':') ?? -1;
      if (separator < 1) throw new ProviderConfigurationError('Name.com credentials must use username:token format.');
      const response = await fetch(endpoint || 'https://api.name.com/core/v1/domains:checkAvailability', {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Basic ${btoa(apiKey!)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainNames: [domain], purchaseType: 'registration' }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new ProviderConfigurationError(`Name.com returned HTTP ${response.status}.`);
      const payload = await response.json() as { results?: Array<Record<string, unknown>> };
      const result = payload.results?.find((item) => item.domainName === domain) ?? payload.results?.[0];
      const registrationPrice = Number(result?.purchasePrice);
      const renewalPrice = Number(result?.renewalPrice);
      if (!result || typeof result.purchasable !== 'boolean' || !Number.isFinite(registrationPrice) || !Number.isFinite(renewalPrice)) throw new ProviderConfigurationError('Name.com response is missing availability or pricing.');
      return { domain, available: result.purchasable, registrationPrice, renewalPrice, premium: result.premium === true, registrar: 'Name.com', checkedAt: new Date().toISOString(), stale: false };
    },
  };
}

function liveProvider(endpoint?: string, apiKey?: string): AvailabilityProvider {
  return {
    mode: 'live',
    label: 'Live registrar adapter',
    async check(domain) {
      const response = await fetchLiveProviderJson({
        provider: 'Registrar',
        endpoint: endpoint || process.env.REGISTRAR_API_URL,
        apiKey: apiKey || process.env.REGISTRAR_API_KEY,
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

export function getAvailabilityProvider(mode = process.env.DOMAIN_PROVIDER, endpoint?: string, apiKey?: string, adapter: 'generic' | 'namecom' = 'generic'): AvailabilityProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode === 'live') return adapter === 'namecom' ? nameComProvider(endpoint, apiKey) : liveProvider(endpoint, apiKey);
  return deterministicProvider(providerMode);
}

export function getAvailabilityProviderStatus(mode = process.env.DOMAIN_PROVIDER, endpoint?: string, apiKey?: string, adapter: 'generic' | 'namecom' = 'generic'): {
  mode: AvailabilityProviderMode;
  label: string;
  liveReady: boolean;
} {
  const provider = getAvailabilityProvider(mode, endpoint, apiKey, adapter);
  return {
    mode: provider.mode,
    label: provider.label,
    liveReady: provider.mode !== 'live' ? true : adapter === 'namecom' ? Boolean(apiKey || process.env.REGISTRAR_API_KEY) : Boolean((endpoint || process.env.REGISTRAR_API_URL) && (apiKey || process.env.REGISTRAR_API_KEY)),
  };
}
