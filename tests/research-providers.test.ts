import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailabilityProvider } from '../src/lib/providers/availability';
import { getComparableSalesProvider } from '../src/lib/providers/comparable-sales';
import { fetchLiveProviderJson, ProviderRequestError } from '../src/lib/providers/core';
import { getHistoryProvider } from '../src/lib/providers/history';
import { getTrademarkProvider } from '../src/lib/providers/trademark';

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
