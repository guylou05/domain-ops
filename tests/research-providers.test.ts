import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailabilityProvider } from '../src/lib/providers/availability';
import { getComparableSalesProvider } from '../src/lib/providers/comparable-sales';
import { fetchLiveProviderJson, ProviderRequestError } from '../src/lib/providers/core';
import { getHistoryProvider } from '../src/lib/providers/history';
import { getTrademarkProvider } from '../src/lib/providers/trademark';
import { getPublicBusinessProvider } from '../src/lib/providers/public-business';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('research provider adapters', () => {
  it('returns normalized deterministic research results', async () => {
    const trademark = await getTrademarkProvider('mock').check('workflowpilot.ai');
    const sales = await getComparableSalesProvider('deterministic').search('workflowpilot.ai');
    const history = await getHistoryProvider('mock').check('workflowpilot.ai', 88);

    expect(trademark.riskLevel).toBe('LOW');
    expect(sales.sales).toHaveLength(3);
    expect(sales.sales.every((sale) => sale.price > 0)).toBe(true);
    expect(history.riskLevel).toBe('LOW');
  });

  it('normalizes a live registrar response', async () => {
    vi.stubEnv('REGISTRAR_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      available: true,
      registrationPrice: 19,
      renewalPrice: 24,
      premium: false,
      registrar: 'ProviderRegistrar',
    }), { status: 200 }));

    const result = await getAvailabilityProvider('live', 'https://provider.example/availability').check('workflowpilot.ai');
    expect(result).toMatchObject({ available: true, registrationPrice: 19, registrar: 'ProviderRegistrar', stale: false });
  });

  it('implements the Name.com availability and pricing contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ results: [{ domainName: 'workflowpilot.ai', purchasable: true, purchasePrice: 39, renewalPrice: 79, premium: false }] }), { status: 200 }));
    const result = await getAvailabilityProvider('live', 'https://api.name.com/core/v1/domains:checkAvailability', 'reseller:token', 'namecom').check('workflowpilot.ai');
    expect(result).toMatchObject({ available: true, registrationPrice: 39, renewalPrice: 79, registrar: 'Name.com' });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }) }));
  });

  it('normalizes SEC public-company evidence with an identifying contact', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ 0: { cik_str: 1234, ticker: 'FLOW', title: 'Workflowpilot Holdings' } }), { status: 200 }));
    const result = await getPublicBusinessProvider('live', 'https://www.sec.gov/files/company_tickers.json', 'research@example.com').search('workflowpilot.ai');
    expect(result.matches[0]).toMatchObject({ companyName: 'Workflowpilot Holdings', jurisdiction: 'US-SEC', identifier: '0000001234' });
  });

  it('enforces normalized live contracts for trademark, sales, and history adapters', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/trademark')) return new Response(JSON.stringify({ riskLevel: 'moderate', matches: [{ mark: 'Workflow Pilot', owner: 'Example Inc.' }], disclaimer: 'Screening only.' }), { status: 200 });
      if (url.includes('/sales')) return new Response(JSON.stringify({ sales: [{ domain: 'workflowlabs.ai', tld: '.ai', price: 3200, saleDate: '2026-01-10T00:00:00.000Z', marketplace: 'Contract Market' }] }), { status: 200 });
      return new Response(JSON.stringify({ riskLevel: 'low', flags: [], evidence: ['Archive snapshot reviewed.'] }), { status: 200 });
    });
    await expect(getTrademarkProvider('live', 'https://provider.example/trademark', 'key').check('workflowpilot.ai')).resolves.toMatchObject({ riskLevel: 'MODERATE', stale: false });
    await expect(getComparableSalesProvider('live', 'https://provider.example/sales', 'key').search('workflowpilot.ai')).resolves.toMatchObject({ sales: [expect.objectContaining({ price: 3200 })] });
    await expect(getHistoryProvider('live', 'https://provider.example/history', 'key').check('workflowpilot.ai')).resolves.toMatchObject({ riskLevel: 'LOW', evidence: ['Archive snapshot reviewed.'] });
  });

  it('returns stale cached data after a retryable provider failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 42 }), { status: 200 }))
      .mockRejectedValueOnce(new Error('network unavailable'));
    const options = {
      provider: 'Cache test', endpoint: 'https://provider.example/cache', apiKey: 'key', domain: 'cache-test.example',
      cacheTtlMs: 0,
      parse: (value: unknown) => (value as { value: number }).value,
    };

    expect((await fetchLiveProviderJson(options)).data).toBe(42);
    const stale = await fetchLiveProviderJson(options);
    expect(stale).toMatchObject({ data: 42, stale: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses a structured error when live data has no fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(fetchLiveProviderJson({
      provider: 'Failure test', endpoint: 'https://provider.example/failure', apiKey: 'key', domain: 'failure.example', parse: (value) => value,
    })).rejects.toBeInstanceOf(ProviderRequestError);
  });
});
