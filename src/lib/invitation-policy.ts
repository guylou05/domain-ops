import { createHash, randomBytes } from 'node:crypto';
import type { Role } from '@prisma/client';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const satisfies readonly Role[];

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function normalizeInvitationEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isInvitableRole(value: string): value is InvitableRole {
  return INVITABLE_ROLES.includes(value as InvitableRole);
}

export function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function invitationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

export function invitationIsUsable(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): boolean {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt.getTime() > now.getTime();
}
