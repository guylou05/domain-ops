'use server';

import { compare } from 'bcryptjs';
import QRCode from 'qrcode';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { markSessionMfaAuthenticated, markSessionStepUp, revokeAuthSession, revokeOtherAuthSessions } from '@/lib/server/auth-sessions';
import { beginMfaEnrollment, completeMfaEnrollment, disableMfa, replaceMfaRecoveryCodes, verifyMfaChallenge } from '@/lib/server/mfa';
import { assertVerifiedUser, requireWorkspaceContext } from '@/lib/server/workspace-context';

export type SecurityActionResult = {
  ok: boolean;
  message: string;
  setup?: { secret: string; qrDataUrl: string };
  recoveryCodes?: string[];
};

export async function startMfaEnrollment(password: string): Promise<SecurityActionResult> {
  const context = await requireWorkspaceContext();
  assertVerifiedUser(context);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: context.userId },
    select: { email: true, passwordHash: true, mfaEnabledAt: true },
  });
  if (user.mfaEnabledAt) return { ok: false, message: 'Two-factor authentication is already enabled.' };
  if (!user.passwordHash || !(await compare(password, user.passwordHash))) return { ok: false, message: 'Current password is incorrect.' };

  const enrollment = await beginMfaEnrollment(context.userId, user.email);
  const qrDataUrl = await QRCode.toDataURL(enrollment.provisioningUri, { width: 240, margin: 1 });
  await recordAuditEvent(context, { action: 'account.mfa_enrollment_started', targetType: 'User', targetId: context.userId });
  return { ok: true, message: 'Scan the QR code, then enter the current authenticator code.', setup: { secret: enrollment.secret, qrDataUrl } };
}

export async function confirmMfaEnrollment(code: string): Promise<SecurityActionResult> {
  const context = await requireWorkspaceContext();
  assertVerifiedUser(context);
  const recoveryCodes = await completeMfaEnrollment(context.userId, code);
  if (!recoveryCodes) return { ok: false, message: 'The authenticator code is invalid or the enrollment expired.' };

  await markSessionMfaAuthenticated(context.authSessionId, context.userId);
  await revokeOtherAuthSessions(context.userId, context.authSessionId);
  await recordAuditEvent(context, { action: 'account.mfa_enabled', targetType: 'User', targetId: context.userId });
  revalidatePath('/settings');
  return { ok: true, message: 'Two-factor authentication is enabled. Store these recovery codes securely.', recoveryCodes };
}

export async function regenerateRecoveryCodes(code: string): Promise<SecurityActionResult> {
  const context = await requireWorkspaceContext();
  if (!(await verifyMfaChallenge(context.userId, code))) return { ok: false, message: 'The authenticator or recovery code is invalid.' };
  const recoveryCodes = await replaceMfaRecoveryCodes(context.userId);
  await markSessionStepUp(context.authSessionId, context.userId);
  await revokeOtherAuthSessions(context.userId, context.authSessionId);
  await recordAuditEvent(context, { action: 'account.mfa_recovery_codes_replaced', targetType: 'User', targetId: context.userId });
  revalidatePath('/settings');
  return { ok: true, message: 'Previous recovery codes were invalidated.', recoveryCodes };
}

export async function turnOffMfa(password: string, code: string): Promise<SecurityActionResult> {
  const context = await requireWorkspaceContext();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: context.userId }, select: { passwordHash: true, mfaEnabledAt: true } });
  if (!user.mfaEnabledAt) return { ok: false, message: 'Two-factor authentication is not enabled.' };
  if (!user.passwordHash || !(await compare(password, user.passwordHash))) return { ok: false, message: 'Current password is incorrect.' };
  if (!(await verifyMfaChallenge(context.userId, code))) return { ok: false, message: 'The authenticator or recovery code is invalid.' };

  await disableMfa(context.userId);
  await markSessionMfaAuthenticated(context.authSessionId, context.userId);
  await revokeOtherAuthSessions(context.userId, context.authSessionId);
  await recordAuditEvent(context, { action: 'account.mfa_disabled', targetType: 'User', targetId: context.userId });
  revalidatePath('/settings');
  return { ok: true, message: 'Two-factor authentication is disabled.' };
}

export async function revokeSession(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  const id = String(formData.get('id') ?? '');
  if (!id || id === context.authSessionId) throw new Error('The current session must be ended with Log out.');
  if (!(await revokeAuthSession(id, context.userId))) throw new Error('The active session was not found.');
  await recordAuditEvent(context, { action: 'account.session_revoked', targetType: 'AuthSession', targetId: id });
  revalidatePath('/settings');
}

export async function revokeAllOtherSessions(): Promise<void> {
  const context = await requireWorkspaceContext();
  await revokeOtherAuthSessions(context.userId, context.authSessionId);
  await recordAuditEvent(context, { action: 'account.other_sessions_revoked', targetType: 'AuthSession', targetId: context.authSessionId });
  revalidatePath('/settings');
}
