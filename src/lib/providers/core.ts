export type ProviderMode = 'deterministic' | 'mock' | 'live';

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

export class ProviderRequestError extends Error {
  readonly provider: string;
  readonly retryable: boolean;

  constructor(provider: string, message: string, retryable = true) {
    super(message);
    this.name = 'ProviderRequestError';
    this.provider = provider;
    this.retryable = retryable;
  }
}

export function normalizeProviderMode(value: string | undefined, fallback: ProviderMode = 'deterministic'): ProviderMode {
  const normalized = (value ?? fallback).trim().toLowerCase();
  if (normalized === 'mock' || normalized === 'deterministic' || normalized === 'live') return normalized;
  throw new ProviderConfigurationError(`Unsupported provider mode "${value}". Use deterministic, mock, or live.`);
}

type CacheEntry = {
  data: unknown;
  fetchedAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const lastRequestAt = new Map<string, number>();
const requestQueues = new Map<string, Promise<void>>();

async function waitForProviderSlot(provider: string, minimumIntervalMs: number): Promise<void> {
  const previous = requestQueues.get(provider) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const waitMs = Math.max(0, minimumIntervalMs - (Date.now() - (lastRequestAt.get(provider) ?? 0)));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestAt.set(provider, Date.now());
  });
  requestQueues.set(provider, next);
  await next;
}

export type LiveProviderResponse<T> = {
  data: T;
  checkedAt: string;
  stale: boolean;
};

export async function fetchLiveProviderJson<T>(options: {
  provider: string;
  endpoint: string | undefined;
  apiKey: string | undefined;
  domain: string;
  parse: (value: unknown) => T;
  cacheTtlMs?: number;
  staleTtlMs?: number;
  timeoutMs?: number;
  minimumIntervalMs?: number;
}): Promise<LiveProviderResponse<T>> {
  const endpoint = options.endpoint?.trim();
  if (!endpoint || !options.apiKey) {
    throw new ProviderConfigurationError(`${options.provider} live mode requires an endpoint URL and API key.`);
  }

  const url = new URL(endpoint);
  url.searchParams.set('domain', options.domain);
  const cacheKey = `${options.provider}:${url.toString()}`;
  const now = Date.now();
  const cacheTtlMs = options.cacheTtlMs ?? 300000;
  const staleTtlMs = options.staleTtlMs ?? 86400000;
  const cached = responseCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < cacheTtlMs) {
    return { data: cached.data as T, checkedAt: new Date(cached.fetchedAt).toISOString(), stale: false };
  }

  await waitForProviderSlot(options.provider, options.minimumIntervalMs ?? 250);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${options.apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ProviderRequestError(options.provider, `${options.provider} returned HTTP ${response.status}.`, response.status >= 500 || response.status === 429);
    }
    const data = options.parse(await response.json());
    const fetchedAt = Date.now();
    responseCache.set(cacheKey, { data, fetchedAt });
    return { data, checkedAt: new Date(fetchedAt).toISOString(), stale: false };
  } catch (error) {
    if (cached && now - cached.fetchedAt < staleTtlMs) {
      return { data: cached.data as T, checkedAt: new Date(cached.fetchedAt).toISOString(), stale: true };
    }
    if (error instanceof ProviderConfigurationError || error instanceof ProviderRequestError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown provider failure.';
    throw new ProviderRequestError(options.provider, `${options.provider} request failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}
