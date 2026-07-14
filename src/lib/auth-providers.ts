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

export function getAuthProviderReadiness(env: AuthEnv = process.env as AuthEnv): AuthProviderReadiness {
  return {
    credentials: true,
    google: isGoogleOAuthConfigured(env),
  };
}
