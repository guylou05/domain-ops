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

  const [domainCount, opportunityStats, qualifiedOpportunities, portfolioStats, watchlistCount, riskGroups, topOpportunities] = await Promise.all([
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
  ]);

  return {
    analyzedDomains: domainCount,
    qualifiedOpportunities,
    averageScore: Math.round(opportunityStats._avg.score ?? 0),
    estimatedRetailValue: decimalToNumber(opportunityStats._sum.estimatedRetailMin),
    portfolioValue: decimalToNumber(portfolioStats._sum.currentValuation),
    renewalExposure: decimalToNumber(portfolioStats._sum.renewalCost),
    watchlistCount,
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
