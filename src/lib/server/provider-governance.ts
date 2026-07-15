import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ProviderPolicy = {
  cacheTtlMinutes: number;
  staleTtlHours: number;
  dailyQuota: number;
  minimumIntervalMs: number;
};

export class ProviderQuotaError extends Error {
  constructor(provider: string, limit: number) {
    super(`${provider} daily request quota of ${limit} has been reached.`);
    this.name = 'ProviderQuotaError';
  }
}

const providerQueues = new Map<string, Promise<void>>();

function periodStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function recordCacheHit(workspaceId: string, provider: string, now: Date): Promise<void> {
  await prisma.providerUsage.upsert({
    where: { workspaceId_provider_periodStart: { workspaceId, provider, periodStart: periodStart(now) } },
    update: { cacheHits: { increment: 1 } },
    create: { workspaceId, provider, periodStart: periodStart(now), cacheHits: 1 },
  });
}

async function consumeRequest(workspaceId: string, provider: string, policy: ProviderPolicy, now: Date): Promise<void> {
  const period = periodStart(now);
  const usage = await prisma.providerUsage.findUnique({ where: { workspaceId_provider_periodStart: { workspaceId, provider, periodStart: period } } });
  if ((usage?.requestCount ?? 0) >= policy.dailyQuota) throw new ProviderQuotaError(provider, policy.dailyQuota);
  const waitMs = Math.max(0, policy.minimumIntervalMs - (now.getTime() - (usage?.lastRequestAt?.getTime() ?? 0)));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  await prisma.providerUsage.upsert({
    where: { workspaceId_provider_periodStart: { workspaceId, provider, periodStart: period } },
    update: { requestCount: { increment: 1 }, lastRequestAt: new Date() },
    create: { workspaceId, provider, periodStart: period, requestCount: 1, lastRequestAt: new Date() },
  });
}

async function acquireProviderSlot(workspaceId: string, provider: string, policy: ProviderPolicy): Promise<void> {
  const key = `${workspaceId}:${provider}`;
  const previous = providerQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => consumeRequest(workspaceId, provider, policy, new Date()));
  providerQueues.set(key, next);
  try {
    await next;
  } finally {
    if (providerQueues.get(key) === next) providerQueues.delete(key);
  }
}

export async function runGovernedProviderCall<T>(options: {
  workspaceId: string;
  provider: string;
  cacheKey: string;
  policy: ProviderPolicy;
  execute: () => Promise<T>;
  markStale: (value: T) => T;
}): Promise<T> {
  const now = new Date();
  const cached = await prisma.providerCache.findUnique({
    where: { workspaceId_provider_cacheKey: { workspaceId: options.workspaceId, provider: options.provider, cacheKey: options.cacheKey } },
  });
  if (cached && cached.expiresAt > now) {
    await recordCacheHit(options.workspaceId, options.provider, now);
    return cached.payload as T;
  }

  await acquireProviderSlot(options.workspaceId, options.provider, options.policy);
  try {
    const result = await options.execute();
    const payload = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    const fetchedAt = new Date();
    await prisma.providerCache.upsert({
      where: { workspaceId_provider_cacheKey: { workspaceId: options.workspaceId, provider: options.provider, cacheKey: options.cacheKey } },
      update: {
        payload,
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + options.policy.cacheTtlMinutes * 60_000),
        staleAt: new Date(fetchedAt.getTime() + options.policy.staleTtlHours * 3_600_000),
      },
      create: {
        workspaceId: options.workspaceId,
        provider: options.provider,
        cacheKey: options.cacheKey,
        payload,
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + options.policy.cacheTtlMinutes * 60_000),
        staleAt: new Date(fetchedAt.getTime() + options.policy.staleTtlHours * 3_600_000),
      },
    });
    return result;
  } catch (error) {
    await prisma.providerUsage.updateMany({
      where: { workspaceId: options.workspaceId, provider: options.provider, periodStart: periodStart(now) },
      data: { failures: { increment: 1 } },
    });
    if (cached && cached.staleAt > now) {
      await recordCacheHit(options.workspaceId, options.provider, now);
      return options.markStale(cached.payload as T);
    }
    throw error;
  }
}

export async function getProviderGovernanceView(workspaceId: string) {
  const period = periodStart(new Date());
  const [usage, caches] = await Promise.all([
    prisma.providerUsage.findMany({ where: { workspaceId, periodStart: period }, orderBy: { provider: 'asc' } }),
    prisma.providerCache.groupBy({ by: ['provider'], where: { workspaceId }, _count: { _all: true }, _max: { fetchedAt: true } }),
  ]);
  const cacheByProvider = new Map(caches.map((item) => [item.provider, item]));
  return usage.map((item) => ({ ...item, cacheEntries: cacheByProvider.get(item.provider)?._count._all ?? 0, latestFetchAt: cacheByProvider.get(item.provider)?._max.fetchedAt ?? null }));
}
