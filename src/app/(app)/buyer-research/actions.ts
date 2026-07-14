'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { generateBuyerTargetsForWorkspace } from '@/lib/server/workflow-generators';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function generateBuyerTargets(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  await generateBuyerTargetsForWorkspace(context.workspaceId);

  revalidatePath('/buyer-research');
  revalidatePath('/outreach');
  revalidatePath('/overview');
  redirect('/buyer-research');
}
