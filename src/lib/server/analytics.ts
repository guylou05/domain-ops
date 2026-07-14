import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';
import { getMonthlyEntitlementUsage } from './entitlements';

export type AnalyticsView = {
  metrics: Array<{ label: string; value: string }>;
  riskMix: Array<{ label: string; value: number }>;
  usage: Array<{ key: string; quantity: number; limit: number | null }>;
  aiUsage: Array<{
    model: string;
    tokens: number;
    costCents: number;
    createdAt: Date;
  }>;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export async function getAnalytics(): Promise<AnalyticsView> {
  const context = await requireWorkspaceContext();

  const [opportunityStats, riskGroups, portfolioStats, listingStats, monthlyUsage, aiUsage] = await Promise.all([
    prisma.domainOpportunity.aggregate({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _avg: { score: true },
      _sum: { estimatedRetailMin: true, buyerCount: true },
      _count: { id: true },
    }),
    prisma.domainOpportunity.groupBy({
      by: ['riskLevel'],
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _count: { riskLevel: true },
      orderBy: { riskLevel: 'asc' },
    }),
    prisma.portfolioItem.aggregate({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _sum: { purchaseCost: true, currentValuation: true, renewalCost: true },
      _count: { id: true },
    }),
    prisma.marketplaceListing.aggregate({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      _avg: { price: true },
      _sum: { price: true },
      _count: { id: true },
    }),
    getMonthlyEntitlementUsage(context.workspaceId),
    prisma.aiUsage.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        model: true,
        promptTokens: true,
        completionTokens: true,
        costCents: true,
        createdAt: true,
      },
    }),
  ]);

  const portfolioCost = decimalToNumber(portfolioStats._sum.purchaseCost);
  const portfolioValue = decimalToNumber(portfolioStats._sum.currentValuation);
  const unrealizedGain = portfolioValue - portfolioCost;

  return {
    metrics: [
      { label: 'Opportunities', value: String(opportunityStats._count.id) },
      { label: 'Average score', value: String(Math.round(opportunityStats._avg.score ?? 0)) },
      { label: 'Retail floor', value: formatCurrency(decimalToNumber(opportunityStats._sum.estimatedRetailMin)) },
      { label: 'Buyer targets', value: String(opportunityStats._sum.buyerCount ?? 0) },
      { label: 'Portfolio value', value: formatCurrency(portfolioValue) },
      { label: 'Unrealized gain', value: formatCurrency(unrealizedGain) },
      { label: 'Renewal exposure', value: formatCurrency(decimalToNumber(portfolioStats._sum.renewalCost)) },
      { label: 'Active listing ask', value: formatCurrency(decimalToNumber(listingStats._sum.price)) },
      { label: 'Average listing', value: formatCurrency(decimalToNumber(listingStats._avg.price)) },
    ],
    riskMix: riskGroups.map((group) => ({
      label: group.riskLevel,
      value: group._count.riskLevel,
    })),
    usage: monthlyUsage.entitlements.map((entitlement) => ({
      key: entitlement.key,
      quantity: entitlement.used,
      limit: entitlement.limit,
    })),
    aiUsage: aiUsage.map((usage) => ({
      model: usage.model,
      tokens: usage.promptTokens + usage.completionTokens,
      costCents: usage.costCents,
      createdAt: usage.createdAt,
    })),
  };
}
