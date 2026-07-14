'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { generateBuyerTargetsForWorkspace } from '@/lib/server/workflow-generators';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function generateBuyerTargets(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  try {
    await generateBuyerTargetsForWorkspace(context.workspaceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate buyer targets.';
    redirect(`/buyer-research?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/buyer-research');
  revalidatePath('/outreach');
  revalidatePath('/overview');
  redirect('/buyer-research');
}
