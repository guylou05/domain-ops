import { describe, expect, it } from 'vitest';
import { getAuthProviderReadiness, isGoogleOAuthConfigured } from '../src/lib/auth-providers';

describe('auth provider readiness', () => {
  it('keeps credentials available by default', () => {
    expect(getAuthProviderReadiness({})).toEqual({ credentials: true, google: false });
  });

  it('enables Google only when both credentials are configured', () => {
    expect(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '' })).toBe(false);
    expect(isGoogleOAuthConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toBe(true);
  });
});
