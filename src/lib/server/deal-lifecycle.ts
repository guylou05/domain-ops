import { prisma } from '@/lib/prisma';
import { renewalRecommendation } from '@/lib/deal-lifecycle';
import { requireWorkspaceContext } from './workspace-context';

const number = (value: { toNumber(): number } | null) => value?.toNumber() ?? null;

export async function getPortfolioDetail(id: string) {
  const context = await requireWorkspaceContext();
  const holding = await prisma.portfolioItem.findFirst({
    where: { id, workspaceId: context.workspaceId },
    include: { domain: { include: { opportunity: true } } },
  });
  if (!holding) return null;

  const [offers, sales, renewals, listings, activity] = await Promise.all([
    prisma.offer.findMany({ where: { workspaceId: context.workspaceId, domainId: holding.domainId }, orderBy: { createdAt: 'desc' } }),
    prisma.sale.findMany({ where: { workspaceId: context.workspaceId, domainId: holding.domainId }, orderBy: { saleDate: 'desc' } }),
    prisma.renewal.findMany({ where: { workspaceId: context.workspaceId, domainId: holding.domainId }, orderBy: { dueDate: 'desc' } }),
    prisma.marketplaceListing.findMany({ where: { workspaceId: context.workspaceId, domainId: holding.domainId }, orderBy: { marketplace: 'asc' } }),
    prisma.auditLog.findMany({
      where: { workspaceId: context.workspaceId, OR: [{ targetId: holding.id }, { targetId: holding.domainId }] },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
  ]);

  return {
    ...holding,
    purchaseCost: holding.purchaseCost.toNumber(), renewalCost: holding.renewalCost.toNumber(),
    currentValuation: holding.currentValuation.toNumber(), buyNowPrice: number(holding.buyNowPrice), minSalePrice: number(holding.minSalePrice),
    offers: offers.map((item) => ({ ...item, amount: item.amount.toNumber() })),
    sales: sales.map((item) => ({ ...item, salePrice: item.salePrice.toNumber(), fees: item.fees.toNumber(), netProfit: item.netProfit.toNumber() })),
    renewals: renewals.map((item) => ({ ...item, cost: item.cost.toNumber() })),
    listings: listings.map((item) => ({ ...item, price: item.price.toNumber() })), activity,
  };
}

export async function getRenewalCalendar() {
  const context = await requireWorkspaceContext();
  const now = new Date();
  const holdings = await prisma.portfolioItem.findMany({
    where: { workspaceId: context.workspaceId, status: 'ACTIVE' }, orderBy: { expirationDate: 'asc' },
    include: { domain: { include: { opportunity: true, offers: { where: { status: { in: ['RECEIVED', 'COUNTERED'] } } }, renewals: { orderBy: { dueDate: 'desc' }, take: 1 } } } },
  });
  return holdings.map((holding) => ({
    id: holding.id, domain: holding.domain.name, dueDate: holding.expirationDate,
    daysUntilDue: Math.ceil((holding.expirationDate.getTime() - now.getTime()) / 86400000),
    cost: holding.renewalCost.toNumber(), valuation: holding.currentValuation.toNumber(), autoRenew: holding.autoRenew,
    recommendation: renewalRecommendation({ score: holding.domain.opportunity?.score ?? null, valuation: holding.currentValuation.toNumber(), renewalCost: holding.renewalCost.toNumber(), openOffers: holding.domain.offers.length, riskLevel: holding.domain.opportunity?.riskLevel ?? null }),
    latestDecision: holding.domain.renewals[0]?.decision ?? null,
  }));
}
