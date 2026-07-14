'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createPortfolioSnapshotForWorkspace } from '@/lib/server/workflow-generators';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function createPortfolioSnapshotReport(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  await createPortfolioSnapshotForWorkspace(context.workspaceId);

  revalidatePath('/reports');
  revalidatePath('/overview');
  redirect('/reports');
}
