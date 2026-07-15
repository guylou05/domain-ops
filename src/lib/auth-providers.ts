export type AuthProviderReadiness = {
  credentials: true;
  google: boolean;
};

type AuthEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export function isGoogleOAuthConfigured(env: AuthEnv = process.env as AuthEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

export function googleProfileEmailIsVerified(profile: unknown): boolean {
  return Boolean(profile && typeof profile === 'object' && 'email_verified' in profile && profile.email_verified === true);
}

export function getAuthProviderReadiness(env: AuthEnv = process.env as AuthEnv): AuthProviderReadiness {
  return {
    credentials: true,
    google: isGoogleOAuthConfigured(env),
  };
}
