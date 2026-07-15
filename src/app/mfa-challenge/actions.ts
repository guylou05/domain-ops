'use server';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getActiveAuthSession, markSessionMfaAuthenticated } from '@/lib/server/auth-sessions';
import { verifyMfaChallenge } from '@/lib/server/mfa';
import type { AuthActionState } from '@/app/(auth)/auth-state';

export async function completeMfaSignIn(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const authSessionId = session?.authSessionId;
  if (!userId || !authSessionId) redirect('/login');
  if (!(await getActiveAuthSession(authSessionId, userId))) redirect('/login?session=expired');

  const code = String(formData.get('code') ?? '').trim();
  if (!(await verifyMfaChallenge(userId, code))) {
    return { ok: false, message: 'Invalid authenticator or recovery code.' };
  }
  await markSessionMfaAuthenticated(authSessionId, userId);
  redirect('/overview');
}
