import { prisma } from '@/lib/prisma';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function domainStem(domain: string): string {
  return domain.split('.')[0].replace(/[^a-z0-9]+/gi, ' ');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function generateBuyerTargetsForWorkspace(workspaceId: string, limit = 5): Promise<number> {
  const opportunities = await prisma.domainOpportunity.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
      domain: {
        buyers: {
          none: { workspaceId },
        },
      },
    },
    orderBy: { score: 'desc' },
    take: limit,
    include: { domain: true },
  });

  for (const [index, opportunity] of opportunities.entries()) {
    const stem = titleCase(domainStem(opportunity.domain.name));
    const companyName = `${stem} Labs`;

    const buyer = await prisma.buyer.create({
      data: {
        workspaceId,
        domainId: opportunity.domainId,
        companyName,
        website: `https://example.com/${opportunity.domain.name.replace(/\./g, '-')}`,
        industry: opportunity.domain.tld === '.ai' ? 'AI software' : 'Digital operations',
        location: index % 2 === 0 ? 'Remote' : 'United States',
        reasonForFit: `${companyName} is a deterministic research target for ${opportunity.domain.name}, based on naming fit, opportunity score ${opportunity.score}, and buyer-count signal ${opportunity.buyerCount}.`,
        relevanceScore: Math.min(98, Math.max(60, opportunity.score + 8 - index)),
        outreachStatus: opportunity.score >= 80 ? 'READY' : 'RESEARCHING',
      },
    });

    await prisma.buyerContact.create({
      data: {
        buyerId: buyer.id,
        name: `Research Lead ${index + 1}`,
        title: 'Growth Lead',
        email: `buyer${index + 1}@example.com`,
        linkedinUrl: null,
      },
    });
  }

  return opportunities.length;
}

export async function createPortfolioSnapshotForWorkspace(workspaceId: string): Promise<string> {
  const [holdings, opportunities, watchlists] = await Promise.all([
    prisma.portfolioItem.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: {
        purchaseCost: true,
        renewalCost: true,
        currentValuation: true,
        autoRenew: true,
      },
    }),
    prisma.domainOpportunity.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      orderBy: { score: 'desc' },
      take: 3,
      include: { domain: { select: { name: true } } },
    }),
    prisma.watchlist.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      include: { items: true },
    }),
  ]);

  const acquisitionCost = holdings.reduce((sum, holding) => sum + holding.purchaseCost.toNumber(), 0);
  const currentValuation = holdings.reduce((sum, holding) => sum + holding.currentValuation.toNumber(), 0);
  const renewalExposure = holdings.reduce((sum, holding) => sum + holding.renewalCost.toNumber(), 0);
  const watchlistItems = watchlists.reduce((sum, watchlist) => sum + watchlist.items.length, 0);

  const report = await prisma.report.create({
    data: {
      workspaceId,
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
    select: { id: true },
  });

  return report.id;
}

export async function createDailyOpportunityDigestForWorkspace(workspaceId: string): Promise<number> {
  const [members, opportunityCount, topOpportunity, unreadNotifications] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    }),
    prisma.domainOpportunity.count({ where: { workspaceId, status: 'ACTIVE' } }),
    prisma.domainOpportunity.findFirst({
      where: { workspaceId, status: 'ACTIVE' },
      orderBy: { score: 'desc' },
      include: { domain: { select: { name: true } } },
    }),
    prisma.notification.count({ where: { workspaceId, readAt: null } }),
  ]);

  for (const member of members) {
    await prisma.notification.create({
      data: {
        workspaceId,
        userId: member.userId,
        title: 'Daily opportunity digest',
        body: topOpportunity
          ? `${opportunityCount} active opportunities are available. Top ranked: ${topOpportunity.domain.name} at score ${topOpportunity.score}. ${unreadNotifications} unread alerts remain.`
          : `No active opportunities are available yet. ${unreadNotifications} unread alerts remain.`,
      },
    });
  }

  return members.length;
}
