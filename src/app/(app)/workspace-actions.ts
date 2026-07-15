'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';
import { WORKSPACE_COOKIE_NAME } from '@/lib/workspace-selection';

export async function switchWorkspace(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  const workspaceId = String(formData.get('workspaceId') ?? '').trim();
  if (!workspaceId) throw new Error('Choose a workspace.');

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: context.userId, workspaceId, workspace: { status: 'ACTIVE' } },
    select: { role: true, workspace: { select: { name: true } } },
  });
  if (!membership) throw new Error('You do not have access to that workspace.');

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE_NAME, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      actorId: context.userId,
      action: 'workspace.switched',
      targetType: 'Workspace',
      targetId: workspaceId,
      metadata: { name: membership.workspace.name, role: membership.role },
    },
  });

  redirect('/overview');
}
