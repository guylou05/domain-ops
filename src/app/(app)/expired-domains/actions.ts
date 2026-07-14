'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { runWorkspaceHistoryChecks } from '@/lib/server/due-diligence';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function runHistoryChecks(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  try {
    await runWorkspaceHistoryChecks(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run history checks.';
    redirect(`/expired-domains?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/expired-domains');
  revalidatePath('/opportunities');
  revalidatePath('/overview');
  redirect('/expired-domains');
}
