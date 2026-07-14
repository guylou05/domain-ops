import { fetchLiveProviderJson, normalizeProviderMode, ProviderConfigurationError, type ProviderMode } from './core';

export type HistoryResult = { domain: string; riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'PROHIBITED'; flags: string[]; evidence: string[]; checkedAt: string; stale: boolean };
export type HistoryProvider = { mode: ProviderMode; label: string; check(domain: string, score?: number): Promise<HistoryResult> };

function deterministicHistory(domain: string, score = 70): HistoryResult {
  const riskLevel = score >= 82 ? 'LOW' : score >= 68 ? 'MODERATE' : 'HIGH';
  return {
    domain, riskLevel, checkedAt: new Date().toISOString(), stale: false,
    flags: riskLevel === 'LOW' ? ['No obvious historical abuse patterns in deterministic screening'] : ['Manual archive review recommended', 'Prior ownership signal requires verification'],
    evidence: [`Deterministic history screening used opportunity score ${score}.`, 'Verify archive and reputation evidence before acquisition.'],
  };
}

export function getHistoryProvider(mode: string | undefined, endpoint?: string): HistoryProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode !== 'live') return { mode: providerMode, label: 'Deterministic history adapter', check: async (domain, score) => deterministicHistory(domain, score) };
  return {
    mode: 'live', label: 'Live domain-history adapter',
    async check(domain) {
      const response = await fetchLiveProviderJson({
        provider: 'Domain history', endpoint: endpoint || process.env.DOMAIN_HISTORY_API_URL, apiKey: process.env.DOMAIN_HISTORY_API_KEY, domain,
        parse(value) {
          const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
          const riskLevel = typeof record.riskLevel === 'string' ? record.riskLevel.toUpperCase() : '';
          if (!['LOW', 'MODERATE', 'HIGH', 'PROHIBITED'].includes(riskLevel)) throw new ProviderConfigurationError('History response has an invalid riskLevel.');
          const strings = (input: unknown) => Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [];
          return { riskLevel: riskLevel as HistoryResult['riskLevel'], flags: strings(record.flags), evidence: strings(record.evidence) };
        },
      });
      return { domain, ...response.data, checkedAt: response.checkedAt, stale: response.stale };
    },
  };
}

export function getHistoryProviderStatus(mode: string | undefined, endpoint?: string) {
  const provider = getHistoryProvider(mode, endpoint);
  return { mode: provider.mode, label: provider.label, liveReady: provider.mode !== 'live' || Boolean((endpoint || process.env.DOMAIN_HISTORY_API_URL) && process.env.DOMAIN_HISTORY_API_KEY) };
}
