import { fetchLiveProviderJson, normalizeProviderMode, ProviderConfigurationError, type ProviderMode } from './core';

export type ComparableSaleResult = { domain: string; tld: string; price: number; saleDate: string; marketplace: string; industry?: string };
export type ComparableSalesResult = { subjectDomain: string; sales: ComparableSaleResult[]; checkedAt: string; stale: boolean };
export type ComparableSalesProvider = { mode: ProviderMode; label: string; search(domain: string): Promise<ComparableSalesResult> };

function deterministicSales(domain: string): ComparableSalesResult {
  const [label = domain, ...tldParts] = domain.split('.');
  const tld = tldParts.length ? `.${tldParts.join('.')}` : '';
  const hash = [...domain].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const checkedAt = new Date().toISOString();
  return {
    subjectDomain: domain,
    checkedAt,
    stale: false,
    sales: [0, 1, 2].map((index) => ({
      domain: `${label}${['labs', 'hub', 'hq'][index]}${tld}`,
      tld,
      price: 800 + ((hash * (index + 3)) % 7200),
      saleDate: new Date(Date.UTC(2025 - index, (hash + index) % 12, 12)).toISOString(),
      marketplace: 'Deterministic sales dataset',
    })),
  };
}

export function getComparableSalesProvider(mode: string | undefined, endpoint?: string): ComparableSalesProvider {
  const providerMode = normalizeProviderMode(mode);
  if (providerMode !== 'live') return { mode: providerMode, label: 'Deterministic comparable-sales adapter', search: async (domain) => deterministicSales(domain) };
  return {
    mode: 'live', label: 'Live comparable-sales adapter',
    async search(domain) {
      const response = await fetchLiveProviderJson({
        provider: 'Comparable sales', endpoint: endpoint || process.env.COMPARABLE_SALES_API_URL, apiKey: process.env.COMPARABLE_SALES_API_KEY, domain,
        parse(value) {
          const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
          if (!Array.isArray(record.sales)) throw new ProviderConfigurationError('Comparable-sales response must include a sales array.');
          return record.sales.map((item) => {
            const sale = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            const price = Number(sale.price);
            const saleDate = typeof sale.saleDate === 'string' ? sale.saleDate : '';
            if (typeof sale.domain !== 'string' || !Number.isFinite(price) || Number.isNaN(Date.parse(saleDate))) throw new ProviderConfigurationError('Comparable-sales response contains an invalid sale.');
            return { domain: sale.domain, tld: typeof sale.tld === 'string' ? sale.tld : '', price, saleDate, marketplace: typeof sale.marketplace === 'string' ? sale.marketplace : 'Live provider', industry: typeof sale.industry === 'string' ? sale.industry : undefined };
          });
        },
      });
      return { subjectDomain: domain, sales: response.data, checkedAt: response.checkedAt, stale: response.stale };
    },
  };
}

export function getComparableSalesProviderStatus(mode: string | undefined, endpoint?: string) {
  const provider = getComparableSalesProvider(mode, endpoint);
  return { mode: provider.mode, label: provider.label, liveReady: provider.mode !== 'live' || Boolean((endpoint || process.env.COMPARABLE_SALES_API_URL) && process.env.COMPARABLE_SALES_API_KEY) };
}
