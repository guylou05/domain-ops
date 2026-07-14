import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type OpportunityListFilters = {
  search?: string;
  risk?: string;
  availability?: string;
  sort?: string;
};

export type OpportunityListItem = {
  domain: string;
  score: number;
  registrationPrice: number | null;
  retailMin: number;
  retailMax: number;
  riskLevel: string;
  buyerCount: number;
  available: boolean | null;
  checkedAt: Date | null;
};

export type OpportunityDetail = OpportunityListItem & {
  notes: string | null;
  source: string;
  renewalPrice: number | null;
  premium: boolean | null;
  registrar: string | null;
  scoreSummary: string | null;
  factors: Array<{
    name: string;
    value: number;
    maxValue: number;
    explanation: string;
  }>;
  valuation: {
    wholesale: number;
    buyNow: number;
    minOffer: number;
    maxAcquisition: number;
    confidence: string;
    explanation: string;
  } | null;
};

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function sortOpportunities(items: OpportunityListItem[], sort: string | undefined): OpportunityListItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'retail':
      return sorted.sort((a, b) => b.retailMax - a.retailMax);
    case 'buyers':
      return sorted.sort((a, b) => b.buyerCount - a.buyerCount);
    case 'domain':
      return sorted.sort((a, b) => a.domain.localeCompare(b.domain));
    case 'checked':
      return sorted.sort((a, b) => (b.checkedAt?.getTime() ?? 0) - (a.checkedAt?.getTime() ?? 0));
    default:
      return sorted.sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  }
}

function matchesAvailability(item: OpportunityListItem, availability: string | undefined): boolean {
  if (!availability || availability === 'all') return true;
  if (availability === 'available') return item.available === true;
  if (availability === 'taken') return item.available === false;
  if (availability === 'unchecked') return item.available === null;
  return true;
}

export async function getOpportunityList(filters: OpportunityListFilters = {}): Promise<OpportunityListItem[]> {
  const context = await requireWorkspaceContext();
  const search = filters.search?.trim().toLowerCase();

  const opportunities = await prisma.domainOpportunity.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: 'ACTIVE',
      ...(filters.risk && filters.risk !== 'all' ? { riskLevel: filters.risk as never } : {}),
      ...(search ? { domain: { name: { contains: search, mode: 'insensitive' } } } : {}),
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
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
  });

  const items = opportunities.map((opportunity) => {
    const latestCheck = opportunity.domain.checks[0];

    return {
      domain: opportunity.domain.name,
      score: opportunity.score,
      registrationPrice: latestCheck ? decimalToNumber(latestCheck.registrationPrice) : null,
      retailMin: decimalToNumber(opportunity.estimatedRetailMin),
      retailMax: decimalToNumber(opportunity.estimatedRetailMax),
      riskLevel: opportunity.riskLevel,
      buyerCount: opportunity.buyerCount,
      available: latestCheck?.available ?? null,
      checkedAt: latestCheck?.checkedAt ?? null,
    };
  });

  return sortOpportunities(items.filter((item) => matchesAvailability(item, filters.availability)), filters.sort);
}

export async function getOpportunityDetail(domainName: string): Promise<OpportunityDetail | null> {
  const context = await requireWorkspaceContext();
  const normalizedName = decodeURIComponent(domainName).trim().toLowerCase();

  const opportunity = await prisma.domainOpportunity.findFirst({
    where: {
      workspaceId: context.workspaceId,
      domain: { name: normalizedName },
    },
    include: {
      domain: {
        include: {
          checks: {
            orderBy: { checkedAt: 'desc' },
            take: 1,
          },
          scores: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              factors: true,
            },
          },
          valuations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!opportunity) return null;

  const latestCheck = opportunity.domain.checks[0];
  const latestScore = opportunity.domain.scores[0];
  const latestValuation = opportunity.domain.valuations[0];

  return {
    domain: opportunity.domain.name,
    score: opportunity.score,
    registrationPrice: latestCheck ? decimalToNumber(latestCheck.registrationPrice) : null,
    retailMin: decimalToNumber(opportunity.estimatedRetailMin),
    retailMax: decimalToNumber(opportunity.estimatedRetailMax),
    riskLevel: opportunity.riskLevel,
    buyerCount: opportunity.buyerCount,
    available: latestCheck?.available ?? null,
    checkedAt: latestCheck?.checkedAt ?? null,
    notes: opportunity.notes,
    source: opportunity.domain.source,
    renewalPrice: latestCheck ? decimalToNumber(latestCheck.renewalPrice) : null,
    premium: latestCheck?.premium ?? null,
    registrar: latestCheck?.registrar ?? null,
    scoreSummary: latestScore?.summary ?? null,
    factors: latestScore?.factors.map((factor) => ({
      name: factor.name,
      value: factor.value,
      maxValue: factor.maxValue,
      explanation: factor.explanation,
    })) ?? [],
    valuation: latestValuation
      ? {
          wholesale: decimalToNumber(latestValuation.wholesale),
          buyNow: decimalToNumber(latestValuation.buyNow),
          minOffer: decimalToNumber(latestValuation.minOffer),
          maxAcquisition: decimalToNumber(latestValuation.maxAcquisition),
          confidence: latestValuation.confidence,
          explanation: latestValuation.explanation,
        }
      : null,
  };
}
