'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function readHoldingId(formData: FormData): string {
  const id = String(formData.get('holdingId') ?? '').trim();
  if (!id) throw new Error('holdingId is required.');
  return id;
}

export async function togglePortfolioAutoRenew(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const holdingId = readHoldingId(formData);
  const holding = await prisma.portfolioItem.findFirst({
    where: {
      id: holdingId,
      workspaceId: context.workspaceId,
    },
    select: {
      id: true,
      autoRenew: true,
    },
  });

  if (!holding) throw new Error('Portfolio holding was not found in this workspace.');

  await prisma.portfolioItem.update({
    where: { id: holding.id },
    data: { autoRenew: !holding.autoRenew },
  });

  revalidatePath('/portfolio');
  revalidatePath('/overview');
}

export async function archivePortfolioHolding(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const holdingId = readHoldingId(formData);

  await prisma.portfolioItem.updateMany({
    where: {
      id: holdingId,
      workspaceId: context.workspaceId,
    },
    data: {
      status: 'ARCHIVED',
      autoRenew: false,
    },
  });

  revalidatePath('/portfolio');
  revalidatePath('/overview');
}
