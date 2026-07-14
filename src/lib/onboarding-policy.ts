import { createHash } from 'node:crypto';

export const TRIAL_DURATION_DAYS = 14;

export function workspaceSlugFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const label = normalized.split('@')[0]?.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const suffix = createHash('sha256').update(normalized).digest('hex').slice(0, 8);
  return `${label.slice(0, 40)}-${suffix}`;
}

export function trialEndsAt(now = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function subscriptionDisplayStatus(status: string, trialEnd: Date | null, now = new Date()): string {
  if (status === 'TRIALING' && trialEnd && trialEnd.getTime() <= now.getTime()) return 'TRIAL_EXPIRED';
  return status;
}

export function subscriptionAllowsUsage(status: string, trialEnd: Date | null, now = new Date()): boolean {
  if (status === 'ACTIVE') return true;
  return status === 'TRIALING' && Boolean(trialEnd && trialEnd.getTime() > now.getTime());
}
