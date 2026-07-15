import { describe, expect, it } from 'vitest';
import { clientAddressFromHeaders, FixedWindowMemoryStore, rateLimitFingerprint, rateLimitMessage } from '../src/lib/rate-limit-policy';

describe('rate limit policy', () => {
  it('enforces and resets a fixed window without extending it', () => {
    let now = 1000;
    const store = new FixedWindowMemoryStore(() => now);
    expect(store.consume('login', 2, 60)).toMatchObject({ allowed: true, remaining: 1, retryAfterSeconds: 60 });
    now += 1000;
    expect(store.consume('login', 2, 60)).toMatchObject({ allowed: true, remaining: 0, retryAfterSeconds: 59 });
    expect(store.consume('login', 2, 60).allowed).toBe(false);
    store.reset('login');
    expect(store.consume('login', 2, 60).allowed).toBe(true);
  });

  it('uses the first forwarded address and never exposes raw discriminators in keys', () => {
    expect(clientAddressFromHeaders(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.2' }))).toBe('203.0.113.9');
    expect(clientAddressFromHeaders({ 'x-real-ip': '198.51.100.7' })).toBe('198.51.100.7');
    const fingerprint = rateLimitFingerprint('User@Example.com');
    expect(fingerprint).toHaveLength(32);
    expect(fingerprint).not.toContain('user');
    expect(rateLimitFingerprint('user@example.com')).toBe(fingerprint);
  });

  it('formats retry guidance in whole minutes', () => {
    expect(rateLimitMessage(1)).toBe('Too many attempts. Try again in 1 minute.');
    expect(rateLimitMessage(61)).toBe('Too many attempts. Try again in 2 minutes.');
  });
});
