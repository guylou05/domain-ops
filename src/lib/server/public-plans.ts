import { prisma } from '@/lib/prisma';

export type PublicPlan = {
  name: string;
  priceCents: number;
  features: string[];
};

const fallbackPlans: PublicPlan[] = [
  {
    name: 'Professional',
    priceCents: 9900,
    features: ['5,000 domain checks per month', 'Buyer research workflows', 'Watchlists and portfolio tracking', 'Reports and workspace analytics'],
  },
];

function humanizeEntitlement(key: string, limit: number | null, enabled: boolean): string {
  const label = key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  if (!enabled) return `${label} disabled`;
  if (limit === null) return label;
  return `${limit.toLocaleString('en-US')} ${label.toLowerCase()}`;
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceCents: 'asc' },
      include: {
        entitlements: {
          orderBy: { key: 'asc' },
        },
      },
    });

    if (plans.length === 0) return fallbackPlans;

    return plans.map((plan) => ({
      name: plan.name,
      priceCents: plan.priceCents,
      features: plan.entitlements.map((entitlement) =>
        humanizeEntitlement(entitlement.key, entitlement.limit, entitlement.enabled),
      ),
    }));
  } catch {
    return fallbackPlans;
  }
}
