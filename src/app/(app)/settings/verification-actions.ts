'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sendEmailVerification } from '@/lib/server/email-verification';
import { getAppConfig } from '@/lib/server/app-config';
import { enforceRateLimits } from '@/lib/server/rate-limit';
import { rateLimitMessage } from '@/lib/rate-limit-policy';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function resendEmailVerification(): Promise<void> {
  const context = await requireWorkspaceContext();
  const config = await getAppConfig();
  if (config.abuseProtection.enabled) {
    const limit = await enforceRateLimits([{
      scope: 'verification_account',
      discriminator: context.userId,
      limit: config.abuseProtection.verificationAccountLimit,
      windowSeconds: config.abuseProtection.verificationWindowMinutes * 60,
    }]);
    if (!limit.allowed) redirect(`/settings?verificationError=${encodeURIComponent(rateLimitMessage(limit.retryAfterSeconds))}`);
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const baseUrl = process.env.NEXTAUTH_URL ?? (host ? `${protocol}://${host}` : 'http://localhost:3000');

  let result: Awaited<ReturnType<typeof sendEmailVerification>>;
  try {
    result = await sendEmailVerification(context.userId, context.workspaceId, baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification email could not be sent.';
    redirect(`/settings?verificationError=${encodeURIComponent(message)}`);
  }
  redirect(`/settings?verification=${result.replaceAll('_', '-')}`);
}
