import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy, createNonce } from '@/lib/content-security-policy';

const protectedRoutes = [
  '/admin',
  '/analytics',
  '/auctions',
  '/buyer-research',
  '/confirm-access',
  '/domain-generator',
  '/discovery',
  '/expired-domains',
  '/integrations',
  '/notifications',
  '/operations',
  '/opportunities',
  '/outreach',
  '/overview',
  '/portfolio',
  '/reports',
  '/renewals',
  '/settings',
  '/watchlists',
];

function isProtected(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function securityHeaders(request: NextRequest) {
  const nonce = createNonce();
  const policy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  return { policy, requestHeaders };
}

export async function proxy(request: NextRequest) {
  const { policy, requestHeaders } = securityHeaders(request);
  let response: NextResponse;

  if (isProtected(request.nextUrl.pathname) && !(await getToken({ req: request }))) {
    const signInUrl = new URL('/login', request.url);
    signInUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    response = NextResponse.redirect(signInUrl);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
