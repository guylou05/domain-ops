import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'domainscout-ai',
    uptime: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
  });
}
