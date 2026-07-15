import { createHash } from 'node:crypto';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  backend: 'redis' | 'memory';
};

type MemoryEntry = { count: number; expiresAt: number };

export class FixedWindowMemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = this.now();
    const current = this.entries.get(key);
    const entry = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + windowSeconds * 1000 }
      : { ...current, count: current.count + 1 };
    this.entries.set(key, entry);
    if (this.entries.size > 10000) {
      for (const [storedKey, stored] of this.entries) if (stored.expiresAt <= now) this.entries.delete(storedKey);
      while (this.entries.size > 10000) {
        const oldestKey = this.entries.keys().next().value;
        if (typeof oldestKey !== 'string') break;
        this.entries.delete(oldestKey);
      }
    }
    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
      backend: 'memory',
    };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}

export function rateLimitFingerprint(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32);
}

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

function readHeader(source: HeaderSource, name: string): string | null {
  if (!source) return null;
  if (source instanceof Headers) return source.get(name);
  const value = source[name] ?? source[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function clientAddressFromHeaders(source: HeaderSource): string {
  const forwarded = readHeader(source, 'x-forwarded-for')?.split(',')[0]?.trim();
  const value = forwarded || readHeader(source, 'x-real-ip')?.trim() || 'unknown';
  return value.slice(0, 128);
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}
