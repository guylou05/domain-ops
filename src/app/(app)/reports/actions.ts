'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createPortfolioSnapshotForWorkspace } from '@/lib/server/workflow-generators';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function createPortfolioSnapshotReport(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  try {
    await createPortfolioSnapshotForWorkspace(context.workspaceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create the portfolio snapshot.';
    redirect(`/reports?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/reports');
  revalidatePath('/overview');
  redirect('/reports');
}
