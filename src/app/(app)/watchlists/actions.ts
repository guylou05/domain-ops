'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function readRequiredId(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function oneYearFromNow(): Date {
  const expiresAt = new Date();
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  return expiresAt;
}

export async function removeWatchlistItem(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const itemId = readRequiredId(formData, 'itemId');

  await prisma.watchlistItem.deleteMany({
    where: {
      id: itemId,
      watchlist: { workspaceId: context.workspaceId },
    },
  });

  revalidatePath('/watchlists');
  revalidatePath('/overview');
}

export async function addWatchlistItemToPortfolio(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const itemId = readRequiredId(formData, 'itemId');

  const item = await prisma.watchlistItem.findFirst({
    where: {
      id: itemId,
      watchlist: { workspaceId: context.workspaceId },
    },
    include: {
      domain: {
        include: {
          checks: {
            orderBy: { checkedAt: 'desc' },
            take: 1,
          },
          opportunity: true,
          valuations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!item) throw new Error('Watchlist item was not found in this workspace.');

  const latestCheck = item.domain.checks[0];
  const latestValuation = item.domain.valuations[0];
  const purchaseCost = latestCheck?.registrationPrice ?? new Prisma.Decimal(0);
  const renewalCost = latestCheck?.renewalPrice ?? new Prisma.Decimal(15);
  const currentValuation = latestValuation?.retailMin ?? item.domain.opportunity?.estimatedRetailMin ?? new Prisma.Decimal(0);
  const buyNowPrice = latestValuation?.buyNow ?? item.domain.opportunity?.estimatedRetailMax ?? null;

  const existingHolding = await prisma.portfolioItem.findFirst({
    where: {
      workspaceId: context.workspaceId,
      domainId: item.domainId,
    },
    select: { id: true },
  });

  if (existingHolding) {
    await prisma.portfolioItem.update({
      where: { id: existingHolding.id },
      data: {
        registrar: latestCheck?.registrar ?? 'Manual',
        renewalCost,
        currentValuation,
        buyNowPrice,
        status: 'ACTIVE',
      },
    });
  } else {
    await prisma.portfolioItem.create({
      data: {
        workspaceId: context.workspaceId,
        domainId: item.domainId,
        registrar: latestCheck?.registrar ?? 'Manual',
        purchaseDate: new Date(),
        purchaseCost,
        renewalCost,
        expirationDate: oneYearFromNow(),
        autoRenew: false,
        currentValuation,
        buyNowPrice,
        status: 'ACTIVE',
      },
    });
  }

  await prisma.watchlistItem.delete({
    where: { id: item.id },
  });

  revalidatePath('/portfolio');
  revalidatePath('/watchlists');
  revalidatePath('/overview');
  redirect('/portfolio');
}
