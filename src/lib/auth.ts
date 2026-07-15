import { compare } from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { googleProfileEmailIsVerified, isGoogleOAuthConfigured } from '@/lib/auth-providers';
import { prisma } from '@/lib/prisma';
import { isAuthDiagnosticsEnabled } from '@/lib/server/app-config';
import { createTrackedAuthSession, revokeAuthSession } from '@/lib/server/auth-sessions';
import { verifyMfaChallenge } from '@/lib/server/mfa';
import { AUTH_SESSION_TTL_MS } from '@/lib/mfa-policy';

type AuthProviders = NextAuthOptions['providers'];

async function logAuthDiagnostic(message: string, metadata: Record<string, string | boolean | undefined> = {}) {
  const enabled = process.env.AUTH_DEBUG === '1' || (await isAuthDiagnosticsEnabled());
  if (!enabled) return;
  console.log('[auth]', message, metadata);
}

function authProviders(): AuthProviders {
  const providers: AuthProviders = [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaCode: { label: 'Authenticator or recovery code', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        if (!email || !password) {
          await logAuthDiagnostic('missing credentials', { hasEmail: Boolean(email), hasPassword: Boolean(password) });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true, mfaEnabledAt: true },
        });

        if (!user?.passwordHash) {
          await logAuthDiagnostic('user missing or password hash missing', { email, found: Boolean(user) });
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);
        await logAuthDiagnostic('credential comparison completed', { email, passwordMatches });
        if (!passwordMatches) return null;
        if (user.mfaEnabledAt && !(await verifyMfaChallenge(user.id, credentials?.mfaCode ?? ''))) {
          await logAuthDiagnostic('MFA challenge failed', { email });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mfaAuthenticated: true,
        };
      },
    }),
  ];

  if (isGoogleOAuthConfigured()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  debug: process.env.AUTH_DEBUG === '1',
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: AUTH_SESSION_TTL_MS / 1000 },
  pages: {
    signIn: '/login',
  },
  providers: authProviders(),
  logger: {
    error(code, metadata) {
      console.error('[next-auth:error]', code, metadata);
    },
    warn(code) {
      console.warn('[next-auth:warn]', code);
    },
    debug(code, metadata) {
      if (process.env.AUTH_DEBUG === '1') {
        console.log('[next-auth:debug]', code, metadata);
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = user.email?.trim().toLowerCase();
      if (!email || !googleProfileEmailIsVerified(profile)) return false;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true, emailVerified: true, mfaEnabledAt: true },
      });
      if (!existing) return false;
      if (!existing.emailVerified) {
        await prisma.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } });
      }
      user.id = existing.id;
      user.name = existing.name ?? user.name;
      user.role = existing.role;
      user.mfaAuthenticated = !existing.mfaEnabledAt;
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id ?? token.sub;
        token.role = user.role ?? token.role ?? 'MEMBER';
        token.authSessionId = await createTrackedAuthSession(
          String(user.id ?? token.sub ?? ''),
          account?.provider ?? 'credentials',
          user.mfaAuthenticated !== false,
        );
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? '');
        session.user.role = String(token.role ?? 'MEMBER');
      }
      session.authSessionId = String(token.authSessionId ?? '');
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.authSessionId) await revokeAuthSession(String(token.authSessionId));
    },
  },
};
