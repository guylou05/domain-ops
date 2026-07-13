import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type AuctionListingView = {
  id: string;
  domain: string;
  marketplace: string;
  price: number;
  status: string;
  opportunityScore: number | null;
  retailMin: number | null;
  retailMax: number | null;
  portfolioValue: number | null;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

export async function getAuctionListings(): Promise<AuctionListingView[]> {
  const context = await requireWorkspaceContext();

  const listings = await prisma.marketplaceListing.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: [{ status: 'asc' }, { price: 'desc' }],
  });

  const domainIds = [...new Set(listings.map((listing) => listing.domainId))];
  const domains = await prisma.domain.findMany({
    where: { id: { in: domainIds } },
    include: {
      opportunity: true,
      portfolioItems: {
        where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
        take: 1,
      },
    },
  });

  const domainById = new Map(domains.map((domain) => [domain.id, domain]));

  return listings.map((listing) => {
    const domain = domainById.get(listing.domainId);
    const portfolioItem = domain?.portfolioItems[0];

    return {
      id: listing.id,
      domain: domain?.name ?? 'Unknown domain',
      marketplace: listing.marketplace,
      price: decimalToNumber(listing.price) ?? 0,
      status: listing.status,
      opportunityScore: domain?.opportunity?.score ?? null,
      retailMin: decimalToNumber(domain?.opportunity?.estimatedRetailMin),
      retailMax: decimalToNumber(domain?.opportunity?.estimatedRetailMax),
      portfolioValue: decimalToNumber(portfolioItem?.currentValuation),
    };
  });
}
