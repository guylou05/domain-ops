'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export async function createPortfolioSnapshotReport(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const [holdings, opportunities, watchlists] = await Promise.all([
    prisma.portfolioItem.findMany({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      select: {
        purchaseCost: true,
        renewalCost: true,
        currentValuation: true,
        autoRenew: true,
      },
    }),
    prisma.domainOpportunity.findMany({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      orderBy: { score: 'desc' },
      take: 3,
      include: { domain: { select: { name: true } } },
    }),
    prisma.watchlist.findMany({
      where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
      include: { items: true },
    }),
  ]);

  const acquisitionCost = holdings.reduce((sum, holding) => sum + holding.purchaseCost.toNumber(), 0);
  const currentValuation = holdings.reduce((sum, holding) => sum + holding.currentValuation.toNumber(), 0);
  const renewalExposure = holdings.reduce((sum, holding) => sum + holding.renewalCost.toNumber(), 0);
  const watchlistItems = watchlists.reduce((sum, watchlist) => sum + watchlist.items.length, 0);

  await prisma.report.create({
    data: {
      workspaceId: context.workspaceId,
      type: 'PORTFOLIO_SNAPSHOT',
      title: `Portfolio snapshot - ${new Date().toLocaleDateString('en-US')}`,
      payload: {
        summary: `Generated snapshot covering ${holdings.length} active holdings, ${opportunities.length} top opportunities, and ${watchlistItems} watchlisted domains.`,
        metrics: [
          { label: 'Active holdings', value: String(holdings.length) },
          { label: 'Acquisition cost', value: formatCurrency(acquisitionCost) },
          { label: 'Current valuation', value: formatCurrency(currentValuation) },
          { label: 'Annual renewals', value: formatCurrency(renewalExposure) },
        ],
        highlights: [
          `${holdings.filter((holding) => holding.autoRenew).length} holdings are set to auto-renew.`,
          `${watchlistItems} domains remain in active watchlist review.`,
          opportunities.length > 0
            ? `Top opportunity: ${opportunities[0].domain.name} with score ${opportunities[0].score}.`
            : 'No active opportunities are available for ranking yet.',
        ],
      },
    },
  });

  revalidatePath('/reports');
  revalidatePath('/overview');
  redirect('/reports');
}
