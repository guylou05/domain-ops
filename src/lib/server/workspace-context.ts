import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? process.env.DEMO_USER_EMAIL ?? 'investor@domainscout.demo';
  const workspaceSlug = process.env.DEMO_WORKSPACE_SLUG ?? 'demo-domain-portfolio';

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspace: { slug: workspaceSlug },
      user: { email: userEmail },
    },
    select: {
      role: true,
      userId: true,
      workspaceId: true,
    },
  });

  if (!membership) {
    throw new Error(`No workspace membership found for ${userEmail} in ${workspaceSlug}. Run npm run db:seed or configure authentication.`);
  }

  return {
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}

export function assertWorkspaceWriter(context: WorkspaceContext): void {
  if (context.role === 'VIEWER') {
    throw new Error('Viewer role cannot modify workspace records.');
  }
}
