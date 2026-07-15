import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';
import { ConfirmAccessForm } from './confirm-form';

export const dynamic = 'force-dynamic';

export default async function ConfirmAccessPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const [context, query] = await Promise.all([requireWorkspaceContext(), searchParams]);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: context.userId }, select: { mfaEnabledAt: true } });
  return (
    <div>
      <h1 className="text-3xl font-bold">Confirm sensitive access</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">Reconfirm your identity before changing protected account or workspace controls.</p>
      <ConfirmAccessForm mfaEnabled={Boolean(user.mfaEnabledAt)} returnTo={query?.returnTo ?? '/settings'} />
    </div>
  );
}
