'use server';

import { compare, hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashInvitationToken, invitationIsUsable } from '@/lib/invitation-policy';
import type { AuthActionState } from '@/app/(auth)/auth-state';

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function acceptWorkspaceInvitation(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = readString(formData, 'token');
  const name = readString(formData, 'name');
  const password = readString(formData, 'password');
  if (!token || !password) return { ok: false, message: 'A password is required to accept this invitation.' };

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: { id: true, email: true, role: true, workspaceId: true, acceptedAt: true, revokedAt: true, expiresAt: true },
  });
  if (!invitation || !invitationIsUsable(invitation)) {
    return { ok: false, message: 'This invitation is invalid, expired, or already used.' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, passwordHash: true },
  });
  if (existingUser) {
    if (!existingUser.passwordHash || !(await compare(password, existingUser.passwordHash))) {
      return { ok: false, message: 'Enter the existing account password for this email address.' };
    }
  } else if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.' };
  }

  const passwordHash = existingUser ? null : await hash(password, 10);

  try {
    await prisma.$transaction(
      async (tx) => {
        const currentInvitation = await tx.workspaceInvitation.findUnique({
          where: { id: invitation.id },
          select: { acceptedAt: true, revokedAt: true, expiresAt: true },
        });
        if (!currentInvitation || !invitationIsUsable(currentInvitation)) throw new Error('INVITATION_UNAVAILABLE');

        const user =
          existingUser ??
          (await tx.user.create({
            data: {
              email: invitation.email,
              name: name || null,
              passwordHash: passwordHash!,
              role: invitation.role,
            },
            select: { id: true },
          }));

        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
          create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
          update: {},
        });
        await tx.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
        await tx.auditLog.create({
          data: {
            workspaceId: invitation.workspaceId,
            actorId: user.id,
            action: 'workspace_invitation.accepted',
            targetType: 'WorkspaceInvitation',
            targetId: invitation.id,
            metadata: { email: invitation.email, role: invitation.role },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITATION_UNAVAILABLE') {
      return { ok: false, message: 'This invitation is no longer available.' };
    }
    return { ok: false, message: 'The invitation could not be accepted. Please try again.' };
  }

  return { ok: true, message: 'Workspace access is ready. Sign in with this email and password.' };
}
