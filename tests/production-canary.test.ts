import { describe, expect, it } from 'vitest';
import {
  assertCanaryAccountBoundary,
  assertCanaryPage,
  assertSafeCallback,
  CANARY_NAME,
  CookieJar,
  DEFAULT_CANARY_EMAIL,
  readCanaryIdentity,
} from '../scripts/lib/production-canary.mjs';

describe('production canary policy', () => {
  it('requires a strong secret while keeping the identity non-secret', () => {
    expect(readCanaryIdentity({ CANARY_PASSWORD: 'a-secure-production-canary-secret' })).toMatchObject({
      email: DEFAULT_CANARY_EMAIL,
      workspaceSlug: 'demo-domain-portfolio',
    });
    expect(() => readCanaryIdentity({ CANARY_PASSWORD: 'short' })).toThrow(/24 characters/);
  });

  it('refuses account takeover, OAuth links, and cross-workspace membership', () => {
    expect(() => assertCanaryAccountBoundary({ name: 'Real User', accounts: [], memberships: [] }, 'workspace-1')).toThrow(/non-canary/);
    expect(() => assertCanaryAccountBoundary({ name: CANARY_NAME, accounts: [{ id: 'oauth' }], memberships: [] }, 'workspace-1')).toThrow(/OAuth/);
    expect(() => assertCanaryAccountBoundary({ name: CANARY_NAME, accounts: [], memberships: [{ workspaceId: 'workspace-2' }] }, 'workspace-1')).toThrow(/another workspace/);
    expect(() => assertCanaryAccountBoundary({ name: CANARY_NAME, accounts: [], memberships: [{ workspaceId: 'workspace-1' }] }, 'workspace-1')).not.toThrow();
  });

  it('retains cookies and recognizes secure session names', () => {
    const jar = new CookieJar();
    jar.absorb({
      getSetCookie: () => [
        '__Host-next-auth.csrf-token=csrf-value; Path=/; Secure; HttpOnly',
        '__Secure-next-auth.session-token=session-value; Path=/; Secure; HttpOnly',
      ],
      get: () => null,
    });
    expect(jar.hasSession()).toBe(true);
    expect(jar.header()).toContain('__Secure-next-auth.session-token=session-value');
  });

  it('accepts only same-origin overview callbacks and viewer pages', () => {
    expect(() => assertSafeCallback('https://app.example/overview', 'https://app.example')).not.toThrow();
    expect(() => assertSafeCallback('https://attacker.example/overview', 'https://app.example')).toThrow(/unexpected destination/);
    expect(() => assertCanaryPage('/overview', 200, '<h1>Executive dashboard</h1><p>VIEWER</p>', 'Executive dashboard')).not.toThrow();
    expect(() => assertCanaryPage('/overview', 200, '<h1>Executive dashboard</h1><p>OWNER</p>', 'Executive dashboard')).toThrow(/viewer role/);
  });
});
