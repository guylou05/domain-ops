'use server';

import { compare } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { markSessionStepUp } from '@/lib/server/auth-sessions';
import { verifyMfaChallenge } from '@/lib/server/mfa';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';
import type { AuthActionState } from '@/app/(auth)/auth-state';

const RETURN_PATHS = new Set(['/settings', '/integrations', '/admin']);

export async function confirmSensitiveAccess(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const context = await requireWorkspaceContext();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: context.userId },
    select: { passwordHash: true, mfaEnabledAt: true },
  });
  const password = String(formData.get('password') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  const confirmed = user.mfaEnabledAt
    ? await verifyMfaChallenge(context.userId, code)
    : Boolean(user.passwordHash && password && await compare(password, user.passwordHash));
  if (!confirmed) return { ok: false, message: 'The security confirmation was not accepted.' };

  await markSessionStepUp(context.authSessionId, context.userId);
  await recordAuditEvent(context, { action: 'account.step_up_completed', targetType: 'AuthSession', targetId: context.authSessionId });
  const requestedPath = String(formData.get('returnTo') ?? '/settings');
  redirect(RETURN_PATHS.has(requestedPath) ? requestedPath : '/settings');
}
