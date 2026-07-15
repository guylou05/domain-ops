'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  isInvitableRole,
  normalizeInvitationEmail,
} from '@/lib/invitation-policy';
import { recordAuditEvent } from '@/lib/server/audit';
import { assertWorkspaceAdmin, requireWorkspaceContext } from '@/lib/server/workspace-context';
import { isWorkerTaskType } from '@/worker/task-registry';
import { sendPasswordResetEmail } from '@/lib/server/password-recovery';

export async function toggleFeatureFlag(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  const key = String(formData.get('key') ?? '').trim();
  if (!key) throw new Error('Feature flag key is required.');

  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { key: true, enabled: true },
  });

  if (!flag) throw new Error('Feature flag was not found.');

  const enabled = !flag.enabled;
  await prisma.featureFlag.update({
    where: { key: flag.key },
    data: { enabled },
  });

  await recordAuditEvent(context, {
    action: 'feature_flag.toggled',
    targetType: 'FeatureFlag',
    targetId: flag.key,
    metadata: { enabled },
  });

  revalidatePath('/admin');
  revalidatePath('/settings');
  revalidatePath('/integrations');
}

export async function queueBackgroundJob(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);

  const type = String(formData.get('type') ?? '').trim();
  if (!isWorkerTaskType(type)) throw new Error('Unsupported background job type.');

  const job = await prisma.backgroundJob.create({
    data: {
      workspaceId: context.workspaceId,
      type,
      status: 'QUEUED',
      progress: 0,
      payload: { source: 'admin' },
    },
    select: { id: true },
  });

  await recordAuditEvent(context, {
    action: 'background_job.queued',
    targetType: 'BackgroundJob',
    targetId: job.id,
    metadata: { type },
  });

  revalidatePath('/admin');
}

export async function createWorkspaceInvitation(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);

  const email = normalizeInvitationEmail(String(formData.get('email') ?? ''));
  const role = String(formData.get('role') ?? 'MEMBER');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!isInvitableRole(role)) throw new Error('Choose a valid invitation role.');
  if (context.role !== 'OWNER' && role === 'ADMIN') throw new Error('Only workspace owners can invite administrators.');

  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId: context.workspaceId, user: { email } },
    select: { id: true },
  });
  if (existingMember) throw new Error('That user is already a workspace member.');

  const token = createInvitationToken();
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.workspaceInvitation.updateMany({
      where: { workspaceId: context.workspaceId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.workspaceInvitation.create({
      data: {
        workspaceId: context.workspaceId,
        invitedById: context.userId,
        email,
        role,
        tokenHash: hashInvitationToken(token),
        expiresAt: invitationExpiresAt(),
      },
      select: { id: true },
    });
  });

  await recordAuditEvent(context, {
    action: 'workspace_invitation.created',
    targetType: 'WorkspaceInvitation',
    targetId: invitation.id,
    metadata: { email, role },
  });

  revalidatePath('/admin');
  redirect(`/admin?invite=${encodeURIComponent(token)}`);
}

export async function revokeWorkspaceInvitation(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  const id = String(formData.get('id') ?? '');

  const result = await prisma.workspaceInvitation.updateMany({
    where: { id, workspaceId: context.workspaceId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw new Error('The pending invitation was not found.');

  await recordAuditEvent(context, {
    action: 'workspace_invitation.revoked',
    targetType: 'WorkspaceInvitation',
    targetId: id,
  });
  revalidatePath('/admin');
}

export async function updateWorkspaceMemberRole(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  const membershipId = String(formData.get('membershipId') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!isInvitableRole(role)) throw new Error('Choose a valid member role.');

  const member = await prisma.workspaceMember.findFirst({
    where: { id: membershipId, workspaceId: context.workspaceId },
    select: { userId: true, role: true },
  });
  if (!member) throw new Error('Workspace member was not found.');
  if (member.userId === context.userId) throw new Error('You cannot change your own workspace role.');
  if (member.role === 'OWNER') throw new Error('The workspace owner role cannot be changed.');
  if (context.role !== 'OWNER' && (member.role === 'ADMIN' || role === 'ADMIN')) {
    throw new Error('Only workspace owners can manage administrators.');
  }

  await prisma.workspaceMember.update({ where: { id: membershipId }, data: { role } });
  await recordAuditEvent(context, {
    action: 'workspace_member.role_changed',
    targetType: 'WorkspaceMember',
    targetId: membershipId,
    metadata: { previousRole: member.role, role },
  });
  revalidatePath('/admin');
}

export async function removeWorkspaceMember(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  const membershipId = String(formData.get('membershipId') ?? '');

  const member = await prisma.workspaceMember.findFirst({
    where: { id: membershipId, workspaceId: context.workspaceId },
    select: { userId: true, role: true },
  });
  if (!member) throw new Error('Workspace member was not found.');
  if (member.userId === context.userId) throw new Error('You cannot remove yourself from the workspace.');
  if (member.role === 'OWNER') throw new Error('The workspace owner cannot be removed.');
  if (context.role !== 'OWNER' && member.role === 'ADMIN') throw new Error('Only workspace owners can remove administrators.');

  await prisma.workspaceMember.delete({ where: { id: membershipId } });
  await recordAuditEvent(context, {
    action: 'workspace_member.removed',
    targetType: 'WorkspaceMember',
    targetId: membershipId,
    metadata: { role: member.role },
  });
  revalidatePath('/admin');
}

export async function sendMemberRecoveryEmail(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceAdmin(context);
  const membershipId = String(formData.get('membershipId') ?? '');
  const member = await prisma.workspaceMember.findFirst({
    where: { id: membershipId, workspaceId: context.workspaceId },
    select: { userId: true, role: true, user: { select: { email: true } } },
  });
  if (!member) throw new Error('Workspace member was not found.');
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const baseUrl = process.env.NEXTAUTH_URL ?? (host ? `${protocol}://${host}` : 'http://localhost:3000');
  const sent = await sendPasswordResetEmail(member.user.email, baseUrl).catch(() => false);
  if (!sent) redirect('/admin?recoveryError=Transactional+email+is+not+configured+for+this+member.');
  await recordAuditEvent(context, {
    action: 'password_reset.email_requested_by_admin',
    targetType: 'User',
    targetId: member.userId,
    metadata: { email: member.user.email },
  });
  redirect(`/admin?recoveryNotice=${encodeURIComponent(`Recovery email sent to ${member.user.email}.`)}`);
}
