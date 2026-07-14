import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type AuctionFilters = {
  search?: string;
  status?: string;
  sort?: string;
};

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

function sortListings(items: AuctionListingView[], sort: string | undefined): AuctionListingView[] {
  const sorted = [...items];
  switch (sort) {
    case 'price':
      return sorted.sort((a, b) => b.price - a.price);
    case 'value':
      return sorted.sort((a, b) => (b.portfolioValue ?? 0) - (a.portfolioValue ?? 0));
    case 'score':
      return sorted.sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0));
    case 'domain':
      return sorted.sort((a, b) => a.domain.localeCompare(b.domain));
    default:
      return sorted.sort((a, b) => a.status.localeCompare(b.status) || b.price - a.price);
  }
}

export async function getAuctionListings(filters: AuctionFilters = {}): Promise<AuctionListingView[]> {
  const context = await requireWorkspaceContext();
  const search = filters.search?.trim().toLowerCase();

  const listings = await prisma.marketplaceListing.findMany({
    where: {
      workspaceId: context.workspaceId,
      ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
    },
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

  const items = listings.map((listing) => {
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

  return sortListings(items.filter((item) => (search ? item.domain.toLowerCase().includes(search) : true)), filters.sort);
}
