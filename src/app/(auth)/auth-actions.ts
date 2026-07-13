'use server';

import { hash, compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export type AuthActionState = {
  ok: boolean;
  message: string;
};

export const initialAuthActionState: AuthActionState = { ok: false, message: '' };

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function workspaceSlugFromEmail(email: string): string {
  const label = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'workspace';
  return `${label}-workspace`;
}

export async function verifyCredentials(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');

  if (!email || !password) return { ok: false, message: 'Email and password are required.' };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
    return { ok: false, message: 'Invalid email or password.' };
  }

  return { ok: true, message: 'Credentials verified. Session enforcement is the next auth slice.' };
}

export async function registerWorkspaceUser(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const name = readString(formData, 'name');
  const email = readString(formData, 'email').toLowerCase();
  const password = readString(formData, 'password');

  if (!email || !password) return { ok: false, message: 'Email and password are required.' };
  if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters.' };

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) return { ok: false, message: 'An account already exists for that email.' };

  const passwordHash = await hash(password, 10);
  const workspaceSlug = workspaceSlugFromEmail(email);

  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      role: 'OWNER',
      memberships: {
        create: {
          role: 'OWNER',
          workspace: {
            create: {
              name: name ? `${name}'s Workspace` : 'New Workspace',
              slug: workspaceSlug,
            },
          },
        },
      },
    },
  });

  return { ok: true, message: `Account created. Use DEMO_USER_EMAIL=${email} and DEMO_WORKSPACE_SLUG=${workspaceSlug} until sessions are enabled.` };
}

export async function requestPasswordReset(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = readString(formData, 'email').toLowerCase();
  if (!email) return { ok: false, message: 'Email is required.' };

  await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return { ok: true, message: 'If that account exists, a reset flow would be started once email delivery is configured.' };
}
