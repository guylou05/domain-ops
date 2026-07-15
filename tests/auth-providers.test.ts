import { describe, expect, it } from 'vitest';
import { getAuthProviderReadiness, googleProfileEmailIsVerified, isGoogleOAuthConfigured } from '../src/lib/auth-providers';

describe('auth provider readiness', () => {
  it('keeps credentials available by default', () => {
    expect(getAuthProviderReadiness({})).toEqual({ credentials: true, google: false });
  });

  it('enables Google only when both credentials are configured', () => {
    expect(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '' })).toBe(false);
    expect(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toBe(true);
  });

  it('trusts only an explicitly verified Google email claim', () => {
    expect(googleProfileEmailIsVerified({ email_verified: true })).toBe(true);
    expect(googleProfileEmailIsVerified({ email_verified: false })).toBe(false);
    expect(googleProfileEmailIsVerified({})).toBe(false);
  });
});
