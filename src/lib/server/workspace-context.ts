import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { selectWorkspaceMembership, WORKSPACE_COOKIE_NAME } from '@/lib/workspace-selection';
import { authSessionHasRecentStepUp, getActiveAuthSession } from './auth-sessions';

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  emailVerified: boolean;
  authSessionId: string;
  stepUpAt: Date | null;
};

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId || !userEmail) {
    redirect('/login');
  }
  const authSessionId = session.authSessionId;
  if (!authSessionId) redirect('/login?session=expired');
  const authSession = await getActiveAuthSession(authSessionId, userId);
  if (!authSession) redirect('/login?session=expired');
  if (!authSession.mfaAuthenticatedAt) redirect('/mfa-challenge');
  const cookieStore = await cookies();
  const preferredWorkspaceId = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const preferredWorkspaceSlug = process.env.DEMO_WORKSPACE_SLUG;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { status: 'ACTIVE' } },
    select: {
      role: true,
      userId: true,
      workspaceId: true,
      workspace: { select: { slug: true } },
      user: { select: { emailVerified: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const membership = selectWorkspaceMembership(memberships, preferredWorkspaceId, preferredWorkspaceSlug);

  if (!membership) {
    throw new Error(`No workspace membership found for ${userEmail}. Accept an invitation or create a workspace.`);
  }

  return {
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
    emailVerified: Boolean(membership.user.emailVerified),
    authSessionId,
    stepUpAt: authSession.stepUpAt,
  };
}

export function assertWorkspaceWriter(context: WorkspaceContext): void {
  if (context.role === 'VIEWER') {
    throw new Error('Viewer role cannot modify workspace records.');
  }
}

export type WorkspaceNavigation = {
  currentWorkspaceId: string;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: WorkspaceContext['role'];
  }>;
};

export async function getWorkspaceNavigation(): Promise<WorkspaceNavigation> {
  const context = await requireWorkspaceContext();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: context.userId, workspace: { status: 'ACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });

  return {
    currentWorkspaceId: context.workspaceId,
    workspaces: memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
  };
}

export function assertWorkspaceAdmin(context: WorkspaceContext): void {
  if (context.role !== 'OWNER' && context.role !== 'ADMIN') {
    throw new Error('Admin actions require OWNER or ADMIN access.');
  }
}

export function assertVerifiedUser(context: WorkspaceContext): void {
  if (!context.emailVerified) {
    throw new Error('Verify your email before performing this security-sensitive action.');
  }
}

export function requireRecentStepUp(context: WorkspaceContext, returnTo: '/settings' | '/integrations' | '/admin' | '/operations'): void {
  if (!authSessionHasRecentStepUp(context.stepUpAt)) {
    redirect(`/confirm-access?returnTo=${encodeURIComponent(returnTo)}`);
  }
}
