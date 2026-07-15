'use server';

import { redirect } from 'next/navigation';
import { consumeEmailVerificationToken } from '@/lib/server/email-verification';

export async function confirmEmailVerification(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '').trim();
  const verified = token ? await consumeEmailVerificationToken(token) : false;
  const suffix = verified ? '' : '?error=invalid';
  redirect(`/verify-email/${encodeURIComponent(token)}${suffix}`);
}
