import { normalizeProviderMode, ProviderConfigurationError, ProviderRequestError, type ProviderMode } from './core';

export const PUBLIC_BUSINESS_POLICY_VERSION = 'sec-edgar-v1';
export type PublicBusinessMatch = { companyName: string; jurisdiction?: string; identifier?: string; sourceUrl: string };
export type PublicBusinessResult = { subjectDomain: string; matches: PublicBusinessMatch[]; checkedAt: string; stale: boolean; legalNotice: string };
export type PublicBusinessProvider = { mode: ProviderMode; label: string; search(domain: string): Promise<PublicBusinessResult> };

function deterministicResult(domain: string): PublicBusinessResult {
  return { subjectDomain: domain, matches: [], checkedAt: new Date().toISOString(), stale: false, legalNotice: 'Deterministic development data. No public records were queried.' };
}

export function getPublicBusinessProvider(mode: string | undefined, endpoint?: string, contact?: string): PublicBusinessProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode !== 'live') return { mode: providerMode, label: 'Deterministic public-business adapter', search: async (domain) => deterministicResult(domain) };
  const url = endpoint || 'https://www.sec.gov/files/company_tickers.json';
  return {
    mode: 'live',
    label: 'SEC EDGAR public-company adapter',
    async search(domain) {
      if (!contact || !/^\S+@\S+\.\S+$/.test(contact)) throw new ProviderConfigurationError('SEC live mode requires an identifying contact email.');
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': `DomainScout AI ${contact}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new ProviderRequestError('SEC EDGAR', `SEC EDGAR returned HTTP ${response.status}.`, response.status === 429 || response.status >= 500);
      const payload = await response.json() as Record<string, { cik_str?: number; ticker?: string; title?: string }>;
      const query = (domain.split('.')[0] ?? domain).replace(/[-_]/g, ' ').toLowerCase();
      const matches = Object.values(payload).filter((item) => typeof item.title === 'string' && item.title.toLowerCase().includes(query)).slice(0, 10).map((item) => ({
        companyName: item.title!, jurisdiction: 'US-SEC', identifier: item.cik_str ? String(item.cik_str).padStart(10, '0') : item.ticker,
        sourceUrl: item.cik_str ? `https://data.sec.gov/submissions/CIK${String(item.cik_str).padStart(10, '0')}.json` : 'https://www.sec.gov/edgar/search/',
      }));
      return { subjectDomain: domain, matches, checkedAt: new Date().toISOString(), stale: false, legalNotice: 'SEC EDGAR public data. Verify identity and filing context before use.' };
    },
  };
}

export function getPublicBusinessProviderStatus(mode: string | undefined, endpoint?: string, contact?: string) {
  const provider = getPublicBusinessProvider(mode, endpoint, contact);
  return { mode: provider.mode, label: provider.label, liveReady: provider.mode !== 'live' || Boolean(contact && (endpoint || 'https://www.sec.gov/files/company_tickers.json')) };
}
