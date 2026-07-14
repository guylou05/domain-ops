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
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? process.env.DEMO_USER_EMAIL ?? 'investor@domainscout.demo';
  const preferredWorkspaceSlug = process.env.DEMO_WORKSPACE_SLUG;

  const memberships = await prisma.workspaceMember.findMany({
    where: userId ? { userId } : { user: { email: userEmail } },
    select: {
      role: true,
      userId: true,
      workspaceId: true,
      workspace: { select: { slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const membership =
    memberships.find((item) => preferredWorkspaceSlug && item.workspace.slug === preferredWorkspaceSlug) ?? memberships[0];

  if (!membership) {
    throw new Error(`No workspace membership found for ${userEmail}. Accept an invitation or create a workspace.`);
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

export function assertWorkspaceAdmin(context: WorkspaceContext): void {
  if (context.role !== 'OWNER' && context.role !== 'ADMIN') {
    throw new Error('Admin actions require OWNER or ADMIN access.');
  }
}
