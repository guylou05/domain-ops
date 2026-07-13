import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

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

export async function getPortfolioHoldings(): Promise<PortfolioHolding[]> {
  const context = await requireWorkspaceContext();

  const holdings = await prisma.portfolioItem.findMany({
    where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
    orderBy: { expirationDate: 'asc' },
    include: {
      domain: {
        include: {
          opportunity: true,
        },
      },
    },
  });

  return holdings.map((holding) => ({
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
}
