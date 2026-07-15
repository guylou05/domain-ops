import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeRecordOperationalEvent } from '@/lib/server/observability';

export const dynamic = 'force-dynamic';

const release = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local';

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const recent = await prisma.operationalEvent.findFirst({
      where: { source: 'request', event: 'request.health', occurredAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      select: { id: true },
    });
    if (!recent) await safeRecordOperationalEvent({ source: 'request', level: 'INFO', outcome: 'SUCCESS', event: 'request.health', message: 'Health check completed.', durationMs: Date.now() - startedAt, metadata: { method: 'GET', path: '/api/health', status: 200 } });
    return NextResponse.json({ ok: true, service: 'domainscout-ai', release, database: 'connected', uptime: Math.round(process.uptime()), checkedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, service: 'domainscout-ai', release, database: 'unavailable', error: error instanceof Error ? error.message : 'Health check failed.', checkedAt: new Date().toISOString() }, { status: 503 });
  }
}
