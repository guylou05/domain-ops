import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type PortfolioFilters = {
  search?: string;
  renewal?: string;
  sort?: string;
};

export type WatchlistView = {
  id: string;
  name: string;
  notes: string | null;
  itemCount: number;
  createdAt: Date;
  items: Array<{
    id: string;
    domain: string;
    notes: string | null;
    tags: string[];
    score: number | null;
    riskLevel: string | null;
    retailMin: number | null;
    retailMax: number | null;
  }>;
};

export type PortfolioHolding = {
  id: string;
  domain: string;
  registrar: string;
  purchaseDate: Date;
  purchaseCost: number;
  renewalCost: number;
  expirationDate: Date;
  autoRenew: boolean;
  currentValuation: number;
  buyNowPrice: number | null;
  status: string;
  opportunityScore: number | null;
  riskLevel: string | null;
};

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export async function getWatchlists(): Promise<WatchlistView[]> {
  const context = await requireWorkspaceContext();

  const watchlists = await prisma.watchlist.findMany({
    where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        orderBy: { createdAt: 'desc' },
        include: {
          domain: {
            include: {
              opportunity: true,
            },
          },
        },
      },
    },
  });

  return watchlists.map((watchlist) => ({
    id: watchlist.id,
    name: watchlist.name,
    notes: watchlist.notes,
    itemCount: watchlist.items.length,
    createdAt: watchlist.createdAt,
    items: watchlist.items.map((item) => ({
      id: item.id,
      domain: item.domain.name,
      notes: item.notes,
      tags: item.tags,
      score: item.domain.opportunity?.score ?? null,
      riskLevel: item.domain.opportunity?.riskLevel ?? null,
      retailMin: item.domain.opportunity ? decimalToNumber(item.domain.opportunity.estimatedRetailMin) : null,
      retailMax: item.domain.opportunity ? decimalToNumber(item.domain.opportunity.estimatedRetailMax) : null,
    })),
  }));
}

function sortHoldings(items: PortfolioHolding[], sort: string | undefined): PortfolioHolding[] {
  const sorted = [...items];
  switch (sort) {
    case 'value':
      return sorted.sort((a, b) => b.currentValuation - a.currentValuation);
    case 'cost':
      return sorted.sort((a, b) => b.purchaseCost - a.purchaseCost);
    case 'domain':
      return sorted.sort((a, b) => a.domain.localeCompare(b.domain));
    case 'score':
      return sorted.sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0));
    default:
      return sorted.sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime());
  }
}

function matchesRenewal(item: PortfolioHolding, renewal: string | undefined): boolean {
  if (!renewal || renewal === 'all') return true;
  if (renewal === 'auto') return item.autoRenew;
  if (renewal === 'manual') return !item.autoRenew;
  return true;
}

export async function getPortfolioHoldings(filters: PortfolioFilters = {}): Promise<PortfolioHolding[]> {
  const context = await requireWorkspaceContext();
  const search = filters.search?.trim().toLowerCase();

  const holdings = await prisma.portfolioItem.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: 'ACTIVE',
      ...(search ? { domain: { name: { contains: search, mode: 'insensitive' } } } : {}),
    },
    orderBy: { expirationDate: 'asc' },
    include: {
      domain: {
        include: {
          opportunity: true,
        },
      },
    },
  });

  const items = holdings.map((holding) => ({
    id: holding.id,
    domain: holding.domain.name,
    registrar: holding.registrar,
    purchaseDate: holding.purchaseDate,
    purchaseCost: decimalToNumber(holding.purchaseCost),
    renewalCost: decimalToNumber(holding.renewalCost),
    expirationDate: holding.expirationDate,
    autoRenew: holding.autoRenew,
    currentValuation: decimalToNumber(holding.currentValuation),
    buyNowPrice: holding.buyNowPrice ? decimalToNumber(holding.buyNowPrice) : null,
    status: holding.status,
    opportunityScore: holding.domain.opportunity?.score ?? null,
    riskLevel: holding.domain.opportunity?.riskLevel ?? null,
  }));

  return sortHoldings(items.filter((item) => matchesRenewal(item, filters.renewal)), filters.sort);
}
