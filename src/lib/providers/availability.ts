export type AvailabilityProviderMode = 'deterministic' | 'mock' | 'live';

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

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

function normalizeProviderMode(value: string | undefined): AvailabilityProviderMode {
  const normalized = (value ?? 'deterministic').trim().toLowerCase();
  if (normalized === 'mock') return 'mock';
  if (normalized === 'deterministic') return 'deterministic';
  if (normalized === 'live') return 'live';
  throw new ProviderConfigurationError(`Unsupported DOMAIN_PROVIDER "${value}". Use deterministic, mock, or live.`);
}

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

function liveProvider(): AvailabilityProvider {
  return {
    mode: 'live',
    label: 'Live registrar adapter',
    async check() {
      throw new ProviderConfigurationError(
        'Live registrar provider is not configured. Enable credentials, rate limits, caching, and stale-data handling before DOMAIN_PROVIDER=live.',
      );
    },
  };
}

export function getAvailabilityProvider(mode = process.env.DOMAIN_PROVIDER): AvailabilityProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode === 'live') return liveProvider();
  return deterministicProvider(providerMode);
}

export function getAvailabilityProviderStatus(mode = process.env.DOMAIN_PROVIDER): {
  mode: AvailabilityProviderMode;
  label: string;
  liveReady: boolean;
} {
  const provider = getAvailabilityProvider(mode);
  return {
    mode: provider.mode,
    label: provider.label,
    liveReady: provider.mode !== 'live' ? false : Boolean(process.env.REGISTRAR_API_KEY),
  };
}
