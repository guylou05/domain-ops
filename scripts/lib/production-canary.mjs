export const CANARY_NAME = 'DomainScout Production Canary';
export const DEFAULT_CANARY_EMAIL = 'production-canary@domainscout.invalid';
export const DEFAULT_CANARY_WORKSPACE_SLUG = 'demo-domain-portfolio';

export function readCanaryIdentity(env = process.env) {
  const email = (env.CANARY_EMAIL || DEFAULT_CANARY_EMAIL).trim().toLowerCase();
  const password = env.CANARY_PASSWORD ?? '';
  const workspaceSlug = (env.CANARY_WORKSPACE_SLUG || env.DEMO_WORKSPACE_SLUG || DEFAULT_CANARY_WORKSPACE_SLUG).trim();

  if (!email || !email.includes('@')) throw new Error('CANARY_EMAIL must be a valid email address.');
  if (password.length < 24) throw new Error('CANARY_PASSWORD must contain at least 24 characters.');
  if (!workspaceSlug) throw new Error('CANARY_WORKSPACE_SLUG must not be empty.');
  return { email, password, workspaceSlug };
}

export function assertCanaryAccountBoundary(account, workspaceId) {
  if (!account) return;
  if (account.name !== CANARY_NAME) throw new Error('Refusing to repurpose an existing non-canary account.');
  if (account.accounts.length > 0) throw new Error('Canary account must not have linked OAuth accounts.');
  const foreignMembership = account.memberships.find((membership) => membership.workspaceId !== workspaceId);
  if (foreignMembership) throw new Error('Canary account must not belong to another workspace.');
}

export class CookieJar {
  #cookies = new Map();

  absorb(headers) {
    const values = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ?? '').split(/,(?=\s*[^;,]+=)/).filter(Boolean);
    for (const value of values) {
      const [pair, ...attributes] = value.split(';');
      const separator = pair.indexOf('=');
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
      if (expired || !cookieValue) this.#cookies.delete(name);
      else this.#cookies.set(name, cookieValue);
    }
  }

  header() {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  hasSession() {
    return [...this.#cookies.keys()].some((name) => name.endsWith('next-auth.session-token'));
  }
}

export function assertSafeCallback(callbackUrl, baseUrl) {
  const callback = new URL(callbackUrl);
  const base = new URL(baseUrl);
  if (callback.origin !== base.origin || callback.pathname !== '/overview') {
    throw new Error('Credential callback returned an unexpected destination.');
  }
}

export function assertCanaryPage(path, status, body, marker) {
  if (status !== 200) throw new Error(`${path} returned ${status}.`);
  if (!body.includes(marker)) throw new Error(`${path} did not render its expected marker.`);
  if (!body.includes('VIEWER')) throw new Error(`${path} did not confirm the least-privilege viewer role.`);
}
