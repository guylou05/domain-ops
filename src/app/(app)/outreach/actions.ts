'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function readMessageId(formData: FormData): string {
  const id = String(formData.get('messageId') ?? '').trim();
  if (!id) throw new Error('messageId is required.');
  return id;
}

export async function approveOutreachMessage(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const messageId = readMessageId(formData);

  await prisma.outreachMessage.updateMany({
    where: {
      id: messageId,
      workspaceId: context.workspaceId,
      approvedAt: null,
    },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  });

  revalidatePath('/outreach');
  revalidatePath('/overview');
}
