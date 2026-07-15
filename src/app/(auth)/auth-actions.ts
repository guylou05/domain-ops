'use server';

import { hash, compare } from 'bcryptjs';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { OnboardingError, provisionTrialWorkspace } from '@/lib/server/onboarding';
import { sendPasswordResetEmail } from '@/lib/server/password-recovery';
import type { AuthActionState } from './auth-state';

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function verifyCredentials(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');

  if (!email || !password) return { ok: false, message: 'Email and password are required.' };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  return { ok: true, message: 'Credentials verified.' };
}

export async function registerWorkspaceUser(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const name = readString(formData, 'name');
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');
  const planName = readString(formData, 'planName') || 'Professional';

  if (!email || !password) return { ok: false, message: 'Email and password are required.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters.' };

  const passwordHash = await hash(password, 10);

  try {
    await provisionTrialWorkspace({ email, name: name || null, passwordHash, planName });
  } catch (error) {
    if (error instanceof OnboardingError) return { ok: false, message: error.message };
    return { ok: false, message: 'The account could not be created. Please try again.' };
  }

  return { ok: true, message: 'Workspace and 14-day trial created. Signing you in...' };
}

export async function requestPasswordReset(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = readString(formData, 'email').toLowerCase();
  if (!email) return { ok: false, message: 'Email is required.' };

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const baseUrl = process.env.NEXTAUTH_URL ?? (host ? `${protocol}://${host}` : 'http://localhost:3000');
  await sendPasswordResetEmail(email, baseUrl).catch((error) => console.error('[password-reset] delivery failed', error));
  return { ok: true, message: 'If that account exists and recovery email is configured, a reset link has been sent.' };
}
