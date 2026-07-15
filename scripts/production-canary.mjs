import { assertCanaryPage, assertSafeCallback, CookieJar, readCanaryIdentity } from './lib/production-canary.mjs';

const baseUrl = (process.env.CANARY_BASE_URL ?? 'https://domain-ops-production.up.railway.app').replace(/\/$/, '');
const maxResponseMs = Number(process.env.CANARY_MAX_RESPONSE_MS ?? 8000);
const identity = readCanaryIdentity();
const cookies = new CookieJar();
const checks = [
  { path: '/overview', marker: 'Executive dashboard' },
  { path: '/opportunities', marker: 'Opportunities' },
  { path: '/reports', marker: 'Reports' },
];

if (!Number.isFinite(maxResponseMs) || maxResponseMs <= 0) throw new Error('CANARY_MAX_RESPONSE_MS must be a positive number.');

async function request(path, options = {}) {
  const startedAt = performance.now();
  const headers = new Headers(options.headers);
  const cookie = cookies.header();
  if (cookie) headers.set('Cookie', cookie);
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(maxResponseMs),
    ...options,
    headers,
  });
  cookies.absorb(response.headers);
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs > maxResponseMs) throw new Error(`${path} exceeded ${maxResponseMs} ms.`);
  return { response, durationMs };
}

async function csrfToken() {
  const result = await request('/api/auth/csrf', { headers: { Accept: 'application/json' } });
  if (result.response.status !== 200) throw new Error(`CSRF endpoint returned ${result.response.status}.`);
  const payload = await result.response.json();
  if (!payload.csrfToken) throw new Error('CSRF endpoint did not return a token.');
  return payload.csrfToken;
}

console.log(`DomainScout authenticated production canary: ${baseUrl}`);
const csrf = await csrfToken();
const login = await request('/api/auth/callback/credentials', {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    csrfToken: csrf,
    email: identity.email,
    password: identity.password,
    callbackUrl: `${baseUrl}/overview`,
    json: 'true',
  }),
});
if (login.response.status !== 200) throw new Error(`Credential callback returned ${login.response.status}.`);
const loginPayload = await login.response.json();
if (loginPayload.error || !loginPayload.url) throw new Error('Credential callback rejected the canary account.');
assertSafeCallback(loginPayload.url, baseUrl);
if (!cookies.hasSession()) throw new Error('Credential callback did not establish a session cookie.');
console.log(`login: authenticated in ${login.durationMs} ms`);

for (const check of checks) {
  const result = await request(check.path, { headers: { Accept: 'text/html' } });
  const body = await result.response.text();
  assertCanaryPage(check.path, result.response.status, body, check.marker);
  console.log(`${check.path}: viewer page passed in ${result.durationMs} ms`);
}

const signoutCsrf = await csrfToken();
const signout = await request('/api/auth/signout', {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ csrfToken: signoutCsrf, callbackUrl: `${baseUrl}/login`, json: 'true' }),
});
if (signout.response.status !== 200) throw new Error(`Sign-out returned ${signout.response.status}.`);

const revoked = await request('/overview');
if (![302, 303, 307, 308].includes(revoked.response.status)) throw new Error('Signed-out session still reached a protected route.');
console.log(`logout: session revoked in ${signout.durationMs} ms`);
console.log('Authenticated production canary passed.');
