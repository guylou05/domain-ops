import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyGithubCanaryOidcToken } from '@/lib/github-oidc-policy';
import { rotateProductionCanary } from '@/lib/server/production-canary';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  try {
    await verifyGithubCanaryOidcToken(token);
    const password = randomBytes(32).toString('base64url');
    await rotateProductionCanary(password);
    return NextResponse.json({ password }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[production-canary] credential exchange rejected', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Canary credential exchange rejected.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
