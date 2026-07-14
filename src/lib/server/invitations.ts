import { prisma } from '@/lib/prisma';
import { hashInvitationToken, invitationIsUsable } from '@/lib/invitation-policy';

export type InvitationView = {
  email: string;
  role: string;
  workspaceName: string;
  expiresAt: Date;
  usable: boolean;
};

export async function getInvitationView(token: string): Promise<InvitationView | null> {
  if (!token) return null;
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { name: true } },
    },
  });
  if (!invitation) return null;

  return {
    email: invitation.email,
    role: invitation.role,
    workspaceName: invitation.workspace.name,
    expiresAt: invitation.expiresAt,
    usable: invitationIsUsable(invitation),
  };
}
