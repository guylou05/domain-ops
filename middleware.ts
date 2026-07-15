export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/admin/:path*',
    '/analytics/:path*',
    '/auctions/:path*',
    '/buyer-research/:path*',
    '/confirm-access/:path*',
    '/domain-generator/:path*',
    '/expired-domains/:path*',
    '/integrations/:path*',
    '/notifications/:path*',
    '/operations/:path*',
    '/opportunities/:path*',
    '/outreach/:path*',
    '/overview/:path*',
    '/portfolio/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/watchlists/:path*',
  ],
};
