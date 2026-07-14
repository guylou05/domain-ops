import { fetchLiveProviderJson, normalizeProviderMode, ProviderConfigurationError, type ProviderMode } from './core';

export type TrademarkMatch = { mark: string; owner?: string; status?: string; jurisdiction?: string };
export type TrademarkResult = {
  domain: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'PROHIBITED';
  matches: TrademarkMatch[];
  disclaimer: string;
  checkedAt: string;
  stale: boolean;
};
export type TrademarkProvider = { mode: ProviderMode; label: string; check(domain: string): Promise<TrademarkResult> };

function deterministicResult(domain: string): TrademarkResult {
  const label = domain.split('.')[0] ?? domain;
  const riskLevel = label.length <= 4 ? 'MODERATE' : 'LOW';
  return {
    domain,
    riskLevel,
    matches: [],
    disclaimer: 'Deterministic screening only. Obtain professional trademark advice before acquisition or use.',
    checkedAt: new Date().toISOString(),
    stale: false,
  };
}

export function getTrademarkProvider(mode: string | undefined, endpoint?: string, apiKey?: string): TrademarkProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode !== 'live') {
    return { mode: providerMode, label: 'Deterministic trademark screening', check: async (domain) => deterministicResult(domain) };
  }
  return {
    mode: 'live',
    label: 'Live trademark adapter',
    async check(domain) {
      const response = await fetchLiveProviderJson({
        provider: 'Trademark', endpoint: endpoint || process.env.TRADEMARK_API_URL, apiKey: apiKey || process.env.TRADEMARK_API_KEY, domain,
        parse(value) {
          const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
          const riskLevel = typeof record.riskLevel === 'string' ? record.riskLevel.toUpperCase() : '';
          if (!['LOW', 'MODERATE', 'HIGH', 'PROHIBITED'].includes(riskLevel)) throw new ProviderConfigurationError('Trademark response has an invalid riskLevel.');
          const matches = Array.isArray(record.matches) ? record.matches.filter((item): item is TrademarkMatch => Boolean(item && typeof item === 'object' && typeof (item as TrademarkMatch).mark === 'string')) : [];
          return { riskLevel: riskLevel as TrademarkResult['riskLevel'], matches, disclaimer: typeof record.disclaimer === 'string' ? record.disclaimer : 'Not legal advice.' };
        },
      });
      return { domain, ...response.data, checkedAt: response.checkedAt, stale: response.stale };
    },
  };
}

export function getTrademarkProviderStatus(mode: string | undefined, endpoint?: string, apiKey?: string) {
  const provider = getTrademarkProvider(mode, endpoint, apiKey);
  return { mode: provider.mode, label: provider.label, liveReady: provider.mode !== 'live' || Boolean((endpoint || process.env.TRADEMARK_API_URL) && (apiKey || process.env.TRADEMARK_API_KEY)) };
}
