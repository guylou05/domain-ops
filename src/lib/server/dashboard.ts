import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type DashboardSummary = {
  analyzedDomains: number;
  qualifiedOpportunities: number;
  averageScore: number;
  estimatedRetailValue: number;
  portfolioValue: number;
  renewalExposure: number;
  watchlistCount: number;
  revenue: number;
  netProfit: number;
  domainsSold: number;
  activeOffers: number;
  sellThroughRate: number;
  roi: number;
  averageHoldingDays: number;
  upcomingRenewals: number;
  riskBreakdown: Array<{ riskLevel: string; count: number }>;
  topOpportunities: Array<{
    domain: string;
    score: number;
    registrationPrice: number | null;
    retailMin: number;
    retailMax: number;
    buyerCount: number;
    riskLevel: string;
  }>;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const context = await requireWorkspaceContext();

  const [domainCount, opportunityStats, qualifiedOpportunities, portfolioStats, watchlistCount, riskGroups, topOpportunities, sales, activeOffers, upcomingRenewals, activeHoldings] = await Promise.all([
    prisma.domain.count({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' } }),
    prisma.domainOpportunity.aggregate({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _avg: { score: true },
      _sum: { estimatedRetailMin: true },
    }),
    prisma.domainOpportunity.count({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE', score: { gte: 70 } },
    }),
    prisma.portfolioItem.aggregate({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _sum: { currentValuation: true, renewalCost: true },
    }),
    prisma.watchlist.count({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' } }),
    prisma.domainOpportunity.groupBy({
      by: ['riskLevel'],
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _count: { riskLevel: true },
      orderBy: { riskLevel: 'asc' },
    }),
    prisma.domainOpportunity.findMany({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      include: {
        domain: {
          include: {
            checks: {
              orderBy: { checkedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.sale.findMany({ where: { workspaceId: context.workspaceId }, include: { domain: { include: { portfolioItems: { where: { workspaceId: context.workspaceId }, take: 1 } } } } }),
    prisma.offer.count({ where: { workspaceId: context.workspaceId, status: { in: ['RECEIVED', 'COUNTERED'] } } }),
    prisma.portfolioItem.count({ where: { workspaceId: context.workspaceId, status: 'ACTIVE', expirationDate: { lte: new Date(Date.now() + 90 * 86400000) } } }),
    prisma.portfolioItem.count({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' } }),
  ]);

  const revenue = sales.reduce((sum, sale) => sum + sale.salePrice.toNumber(), 0);
  const netProfit = sales.reduce((sum, sale) => sum + sale.netProfit.toNumber(), 0);
  const invested = sales.reduce((sum, sale) => sum + (sale.domain.portfolioItems[0]?.purchaseCost.toNumber() ?? 0), 0);
  const holdingDayTotal = sales.reduce((sum, sale) => sum + Math.max(0, Math.floor((sale.saleDate.getTime() - (sale.domain.portfolioItems[0]?.purchaseDate.getTime() ?? sale.saleDate.getTime())) / 86400000)), 0);

  return {
    analyzedDomains: domainCount,
    qualifiedOpportunities,
    averageScore: Math.round(opportunityStats._avg.score ?? 0),
    estimatedRetailValue: decimalToNumber(opportunityStats._sum.estimatedRetailMin),
    portfolioValue: decimalToNumber(portfolioStats._sum.currentValuation),
    renewalExposure: decimalToNumber(portfolioStats._sum.renewalCost),
    watchlistCount,
    revenue,
    netProfit,
    domainsSold: sales.length,
    activeOffers,
    sellThroughRate: sales.length + activeHoldings > 0 ? (sales.length / (sales.length + activeHoldings)) * 100 : 0,
    roi: invested > 0 ? (netProfit / invested) * 100 : 0,
    averageHoldingDays: sales.length ? Math.round(holdingDayTotal / sales.length) : 0,
    upcomingRenewals,
    riskBreakdown: riskGroups.map((group) => ({
      riskLevel: group.riskLevel,
      count: group._count.riskLevel,
    })),
    topOpportunities: topOpportunities.map((opportunity) => ({
      domain: opportunity.domain.name,
      score: opportunity.score,
      registrationPrice: opportunity.domain.checks[0] ? decimalToNumber(opportunity.domain.checks[0].registrationPrice) : null,
      retailMin: decimalToNumber(opportunity.estimatedRetailMin),
      retailMax: decimalToNumber(opportunity.estimatedRetailMax),
      buyerCount: opportunity.buyerCount,
      riskLevel: opportunity.riskLevel,
    })),
  };
}
