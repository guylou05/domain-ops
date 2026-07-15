import { createClient } from 'redis';
import { headers } from 'next/headers';
import { clientAddressFromHeaders, FixedWindowMemoryStore, rateLimitFingerprint, type RateLimitResult } from '@/lib/rate-limit-policy';
import { safeRecordOperationalEvent } from './observability';

type RedisClient = ReturnType<typeof createClient>;
type RateLimitBucket = { scope: string; discriminator: string; limit: number; windowSeconds: number };

const memoryStore = new FixedWindowMemoryStore();
const globalRateLimit = globalThis as unknown as { rateLimitRedis?: Promise<RedisClient | null> };

async function connectRedis(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) return null;
  const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 2000, reconnectStrategy: false } });
  client.on('error', (error) => console.error('[rate-limit] Redis error:', error.message));
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('[rate-limit] Redis unavailable; using process-local protection.', error instanceof Error ? error.message : error);
    if (client.isOpen) await client.quit().catch(() => undefined);
    return null;
  }
}

function redisClient(): Promise<RedisClient | null> {
  globalRateLimit.rateLimitRedis ??= connectRedis();
  return globalRateLimit.rateLimitRedis;
}

function storageKey(bucket: RateLimitBucket): string {
  return `domainscout:ratelimit:v1:${bucket.scope}:${rateLimitFingerprint(bucket.discriminator)}`;
}

async function consumeBucket(bucket: RateLimitBucket): Promise<RateLimitResult> {
  const key = storageKey(bucket);
  const client = await redisClient();
  if (!client) return memoryStore.consume(key, bucket.limit, bucket.windowSeconds);
  try {
    const result = await client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       local ttl = redis.call('TTL', KEYS[1])
       return { count, ttl }`,
      { keys: [key], arguments: [String(bucket.windowSeconds)] },
    ) as [number, number];
    const count = Number(result[0]);
    return {
      allowed: count <= bucket.limit,
      remaining: Math.max(0, bucket.limit - count),
      retryAfterSeconds: Math.max(1, Number(result[1])),
      backend: 'redis',
    };
  } catch (error) {
    console.error('[rate-limit] Redis command failed; using process-local protection.', error instanceof Error ? error.message : error);
    return memoryStore.consume(key, bucket.limit, bucket.windowSeconds);
  }
}

export async function enforceRateLimits(buckets: RateLimitBucket[]): Promise<RateLimitResult> {
  let latest: RateLimitResult = { allowed: true, remaining: 0, retryAfterSeconds: 0, backend: 'memory' };
  for (const bucket of buckets) {
    const result = await consumeBucket(bucket);
    latest = result;
    if (!result.allowed) {
      await safeRecordOperationalEvent({
        source: 'request',
        level: 'WARN',
        outcome: 'SUCCESS',
        event: `abuse.${bucket.scope}_blocked`,
        message: 'Abuse protection rejected a request.',
        correlationId: rateLimitFingerprint(bucket.discriminator),
        metadata: { scope: bucket.scope, retryAfterSeconds: result.retryAfterSeconds, backend: result.backend },
      });
      return result;
    }
  }
  return { ...latest, allowed: true, retryAfterSeconds: 0 };
}

export async function resetRateLimit(scope: string, discriminator: string): Promise<void> {
  const key = storageKey({ scope, discriminator, limit: 1, windowSeconds: 1 });
  const client = await redisClient();
  if (client) {
    try {
      await client.del(key);
    } catch (error) {
      console.error('[rate-limit] Redis reset failed.', error instanceof Error ? error.message : error);
    }
  }
  memoryStore.reset(key);
}

export async function requestClientAddress(): Promise<string> {
  return clientAddressFromHeaders(await headers());
}
