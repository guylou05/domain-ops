import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, createNonce } from '../src/lib/content-security-policy';

describe('content security policy', () => {
  it('creates independent unpredictable nonces', () => {
    const first = createNonce();
    const second = createNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(second).not.toBe(first);
  });

  it('blocks unsafe script and style execution in production', () => {
    const policy = buildContentSecurityPolicy('test-nonce', false);
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-test-nonce'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain('upgrade-insecure-requests');
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('permits framework evaluation only during development', () => {
    const policy = buildContentSecurityPolicy('test-nonce', true);
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});
