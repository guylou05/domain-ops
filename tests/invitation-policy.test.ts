import { describe, expect, it } from 'vitest';
import {
  INVITATION_TTL_MS,
  hashInvitationToken,
  invitationExpiresAt,
  invitationIsUsable,
  isInvitableRole,
  normalizeInvitationEmail,
} from '../src/lib/invitation-policy';

describe('workspace invitation policy', () => {
  it('normalizes email addresses and restricts assignable roles', () => {
    expect(normalizeInvitationEmail('  Teammate@Example.COM ')).toBe('teammate@example.com');
    expect(isInvitableRole('ADMIN')).toBe(true);
    expect(isInvitableRole('MEMBER')).toBe(true);
    expect(isInvitableRole('VIEWER')).toBe(true);
    expect(isInvitableRole('OWNER')).toBe(false);
  });

  it('hashes bearer tokens without retaining their value', () => {
    const hash = hashInvitationToken('one-time-secret');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('one-time-secret');
    expect(hashInvitationToken('one-time-secret')).toBe(hash);
  });

  it('uses a seven-day expiry and rejects completed invitations', () => {
    const now = new Date('2026-07-14T12:00:00.000Z');
    const expiresAt = invitationExpiresAt(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(INVITATION_TTL_MS);
    expect(invitationIsUsable({ acceptedAt: null, revokedAt: null, expiresAt }, now)).toBe(true);
    expect(invitationIsUsable({ acceptedAt: now, revokedAt: null, expiresAt }, now)).toBe(false);
    expect(invitationIsUsable({ acceptedAt: null, revokedAt: now, expiresAt }, now)).toBe(false);
    expect(invitationIsUsable({ acceptedAt: null, revokedAt: null, expiresAt: now }, now)).toBe(false);
  });
});
