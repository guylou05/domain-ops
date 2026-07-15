export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildContentSecurityPolicy(nonce: string, development = process.env.NODE_ENV === 'development') {
  if (!nonce) throw new Error('A CSP nonce is required.');

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self' https: wss:${development ? ' ws:' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}
