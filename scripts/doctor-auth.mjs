import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();
const demoPassword = 'demo-password';
const emails = ['admin@domainscout.demo', 'investor@domainscout.demo'];

try {
  console.log('DomainScout AI auth doctor');
  for (const email of emails) {
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
      console.log(`✗ ${email} exists`);
      continue;
    }

    const passwordMatches = user.passwordHash ? await compare(demoPassword, user.passwordHash) : false;
    const memberships = user.memberships.map((membership) => `${membership.workspace.slug}:${membership.role}`).join(', ');
    console.log(`✓ ${email} exists`);
    console.log(`  role: ${user.role}`);
    console.log(`  demo password matches: ${passwordMatches ? 'yes' : 'no'}`);
    console.log(`  memberships: ${memberships || 'none'}`);
  }
} finally {
  await prisma.$disconnect();
}
