'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function listingPrice(value: Prisma.Decimal, buyNowPrice: Prisma.Decimal | null): Prisma.Decimal {
  if (buyNowPrice) return buyNowPrice;
  return new Prisma.Decimal(Math.max(99, Math.round(value.toNumber() * 1.25)));
}

export async function publishPortfolioListings(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const holdings = await prisma.portfolioItem.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: 'ACTIVE',
      domain: {
        portfolioItems: {
          some: {
            workspaceId: context.workspaceId,
            status: 'ACTIVE',
          },
        },
      },
    },
    include: {
      domain: {
        include: {
          opportunity: true,
        },
      },
    },
  });

  for (const holding of holdings) {
    const existingListing = await prisma.marketplaceListing.findFirst({
      where: {
        workspaceId: context.workspaceId,
        domainId: holding.domainId,
        marketplace: 'Internal Marketplace',
      },
      select: { id: true },
    });

    const data = {
      price: listingPrice(holding.currentValuation, holding.buyNowPrice),
      status: holding.domain.opportunity?.riskLevel === 'HIGH' ? 'REVIEW' : 'ACTIVE',
    };

    if (existingListing) {
      await prisma.marketplaceListing.update({
        where: { id: existingListing.id },
        data,
      });
    } else {
      await prisma.marketplaceListing.create({
        data: {
          workspaceId: context.workspaceId,
          domainId: holding.domainId,
          marketplace: 'Internal Marketplace',
          ...data,
        },
      });
    }
  }

  revalidatePath('/auctions');
  revalidatePath('/portfolio');
  revalidatePath('/overview');
  redirect('/auctions');
}
