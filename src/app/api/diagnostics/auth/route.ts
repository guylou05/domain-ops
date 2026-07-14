import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const demoPassword = 'demo-password';
const emails = ['admin@domainscout.demo', 'investor@domainscout.demo'];

export async function GET() {
  if (process.env.AUTH_DEBUG !== '1') {
    return NextResponse.json({ ok: false, error: 'Auth diagnostics are disabled.' }, { status: 404 });
  }

  const users = await Promise.all(
    emails.map(async (email) => {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          email: true,
          role: true,
          passwordHash: true,
          memberships: { select: { role: true, workspace: { select: { slug: true } } } },
        },
      });

      if (!user) {
        return { email, exists: false, demoPasswordMatches: false, memberships: [] };
      }

      return {
        email: user.email,
        exists: true,
        role: user.role,
        demoPasswordMatches: user.passwordHash ? await compare(demoPassword, user.passwordHash) : false,
        memberships: user.memberships.map((membership) => ({
          workspace: membership.workspace.slug,
          role: membership.role,
        })),
      };
    }),
  );

  return NextResponse.json({
    ok: users.every((user) => user.exists && user.demoPasswordMatches),
    nextAuthUrlConfigured: Boolean(process.env.NEXTAUTH_URL),
    nextAuthSecretConfigured: Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET),
    users,
  });
}
