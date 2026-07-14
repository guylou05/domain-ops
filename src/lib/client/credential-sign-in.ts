export type CredentialSignInResult = { ok: true; url: string } | { ok: false; message: string };

export async function credentialSignIn(email: string, password: string, callbackPath = '/overview'): Promise<CredentialSignInResult> {
  const csrfResponse = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const csrf = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrf.csrfToken) return { ok: false, message: 'Sign-in failed: missing CSRF token.' };

  const callbackUrl = `${window.location.origin}${callbackPath}`;
  const response = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl, json: 'true' }),
  });
  const result = (await response.json()) as { url?: string; error?: string };
  if (response.ok && result.url && !result.error) return { ok: true, url: result.url };
  return { ok: false, message: result.error ? `Sign-in failed: ${result.error}` : 'Invalid email or password.' };
}
