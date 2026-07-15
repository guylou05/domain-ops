import { createPublicKey, verify } from 'node:crypto';

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const CANARY_OIDC_AUDIENCE = 'domainscout-production-canary';
export const CANARY_REPOSITORY = 'guylou05/domain-ops';
export const CANARY_REPOSITORY_ID = '1298760199';
export const CANARY_WORKFLOW_REF = `${CANARY_REPOSITORY}/.github/workflows/production-canary.yml@refs/heads/main`;

export type GithubOidcClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  repository_id?: string;
  ref?: string;
  workflow_ref?: string;
  event_name?: string;
};

type GithubSigningKey = JsonWebKey & { kid?: string };

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
}

export function assertGithubCanaryClaims(claims: GithubOidcClaims, nowSeconds = Math.floor(Date.now() / 1000)): void {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== GITHUB_OIDC_ISSUER) throw new Error('Unexpected OIDC issuer.');
  if (!audiences.includes(CANARY_OIDC_AUDIENCE)) throw new Error('Unexpected OIDC audience.');
  if (!claims.exp || claims.exp <= nowSeconds - 30) throw new Error('OIDC token expired.');
  if (claims.nbf && claims.nbf > nowSeconds + 30) throw new Error('OIDC token is not active.');
  if (!claims.iat || claims.iat < nowSeconds - 10 * 60 || claims.iat > nowSeconds + 30) throw new Error('OIDC token issue time is invalid.');
  if (claims.repository !== CANARY_REPOSITORY) throw new Error('Unexpected OIDC repository.');
  if (claims.repository_id !== CANARY_REPOSITORY_ID) throw new Error('Unexpected OIDC repository identity.');
  if (claims.ref !== 'refs/heads/main') throw new Error('Canary OIDC token must originate from main.');
  if (claims.workflow_ref !== CANARY_WORKFLOW_REF) throw new Error('Unexpected OIDC workflow.');
  if (claims.event_name !== 'schedule' && claims.event_name !== 'workflow_dispatch') throw new Error('Unexpected OIDC workflow event.');
}

let cachedKeys: { expiresAt: number; keys: GithubSigningKey[] } | null = null;

async function githubSigningKeys(): Promise<GithubSigningKey[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetch(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Unable to load GitHub OIDC signing keys.');
  const payload = await response.json() as { keys?: GithubSigningKey[] };
  if (!payload.keys?.length) throw new Error('GitHub OIDC signing keys are empty.');
  cachedKeys = { keys: payload.keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return payload.keys;
}

export async function verifyGithubCanaryOidcToken(token: string): Promise<GithubOidcClaims> {
  if (!token || token.length > 12000) throw new Error('Invalid OIDC token.');
  const segments = token.split('.');
  if (segments.length !== 3) throw new Error('Invalid OIDC token format.');
  const header = decodeSegment<{ alg?: string; kid?: string }>(segments[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported OIDC signing algorithm.');
  const key = (await githubSigningKeys()).find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error('OIDC signing key not found.');
  const valid = verify('RSA-SHA256', Buffer.from(`${segments[0]}.${segments[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(segments[2], 'base64url'));
  if (!valid) throw new Error('Invalid OIDC token signature.');
  const claims = decodeSegment<GithubOidcClaims>(segments[1]);
  assertGithubCanaryClaims(claims);
  return claims;
}
