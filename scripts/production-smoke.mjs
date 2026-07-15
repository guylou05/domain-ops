const baseUrl = (process.env.SMOKE_BASE_URL ?? 'https://domain-ops-production.up.railway.app').replace(/\/$/, '');
const maxResponseMs = Number(process.env.SMOKE_MAX_RESPONSE_MS ?? 5000);
if (!Number.isFinite(maxResponseMs) || maxResponseMs <= 0) throw new Error('SMOKE_MAX_RESPONSE_MS must be a positive number.');

async function request(path, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(maxResponseMs), ...options });
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs > maxResponseMs) throw new Error(`${path} exceeded ${maxResponseMs} ms (${durationMs} ms).`);
  return { response, durationMs };
}

console.log(`DomainScout AI production smoke: ${baseUrl}`);

const health = await request('/api/health');
if (health.response.status !== 200) throw new Error(`/api/health returned ${health.response.status}.`);
const healthBody = await health.response.json();
if (!healthBody.ok || healthBody.database !== 'connected') throw new Error('/api/health did not report a connected database.');
console.log(`health: ${health.response.status} in ${health.durationMs} ms`);

for (const path of ['/', '/login', '/pricing']) {
  const result = await request(path);
  if (result.response.status !== 200) throw new Error(`${path} returned ${result.response.status}.`);
  console.log(`${path}: ${result.response.status} in ${result.durationMs} ms`);
}

const protectedRoute = await request('/overview');
if (![302, 303, 307, 308].includes(protectedRoute.response.status)) throw new Error(`/overview did not redirect unauthenticated traffic (${protectedRoute.response.status}).`);
const location = protectedRoute.response.headers.get('location') ?? '';
if (!location.includes('/login')) throw new Error(`/overview redirected to an unexpected location: ${location || 'missing'}.`);
console.log(`/overview: protected redirect in ${protectedRoute.durationMs} ms`);

const headers = health.response.headers;
const requiredHeaders = {
  'content-security-policy': "default-src 'self'",
  'permissions-policy': 'camera=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};
for (const [name, expected] of Object.entries(requiredHeaders)) {
  const value = headers.get(name) ?? '';
  if (!value.includes(expected)) throw new Error(`Missing or invalid ${name} header.`);
}
console.log('Security headers: passed');
console.log('Production smoke checks passed.');
