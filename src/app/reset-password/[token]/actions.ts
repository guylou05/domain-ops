'use server';

import { hash } from 'bcryptjs';
import { consumePasswordResetToken } from '@/lib/server/password-recovery';
import type { AuthActionState } from '@/app/(auth)/auth-state';

export async function resetPassword(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const token = String(formData.get('token') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');
  if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters.' };
  if (password !== confirmation) return { ok: false, message: 'Passwords do not match.' };

  const consumed = await consumePasswordResetToken(token, await hash(password, 10));
  if (!consumed) return { ok: false, message: 'This reset link is invalid, expired, or already used.' };
  return { ok: true, message: 'Password updated. You can now sign in.' };
}
