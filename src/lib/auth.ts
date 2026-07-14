import { compare } from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { isGoogleOAuthConfigured } from '@/lib/auth-providers';
import { prisma } from '@/lib/prisma';

type AuthProviders = NextAuthOptions['providers'];

function logAuthDiagnostic(message: string, metadata: Record<string, string | boolean | undefined> = {}) {
  if (process.env.AUTH_DEBUG !== '1') return;
  console.log('[auth]', message, metadata);
}

function authProviders(): AuthProviders {
  const providers: AuthProviders = [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        if (!email || !password) {
          logAuthDiagnostic('missing credentials', { hasEmail: Boolean(email), hasPassword: Boolean(password) });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true },
        });

        if (!user?.passwordHash) {
          logAuthDiagnostic('user missing or password hash missing', { email, found: Boolean(user) });
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);
        logAuthDiagnostic('credential comparison completed', { email, passwordMatches });
        if (!passwordMatches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: authProviders(),
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub;
        token.role = user.role ?? token.role ?? 'MEMBER';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? '');
        session.user.role = String(token.role ?? 'MEMBER');
      }
      return session;
    },
  },
};
