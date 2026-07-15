import { Prisma, RiskLevel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getComparableSalesProvider } from '@/lib/providers/comparable-sales';
import { getHistoryProvider } from '@/lib/providers/history';
import { getTrademarkProvider } from '@/lib/providers/trademark';
import { getAppConfig } from './app-config';
import { withEntitlementUsage } from './entitlements';
import { resolveProviderCredential } from './provider-credentials';
import { assertWorkspaceWriter, type WorkspaceContext } from './workspace-context';
import { observeOperationalCall } from './observability';

function riskLevel(value: 'LOW' | 'MODERATE' | 'HIGH' | 'PROHIBITED'): RiskLevel {
  return RiskLevel[value];
}

export async function runDomainDueDiligence(context: WorkspaceContext, domainName: string) {
  assertWorkspaceWriter(context);
  return withEntitlementUsage(context.workspaceId, 'due_diligence_checks', 1, () => executeDomainDueDiligence(context, domainName));
}

async function executeDomainDueDiligence(context: WorkspaceContext, domainName: string) {
  const domain = await prisma.domain.findFirst({
    where: { workspaceId: context.workspaceId, name: domainName },
    select: { id: true, name: true, opportunity: { select: { score: true } } },
  });
  if (!domain) throw new Error('Domain was not found in this workspace.');

  const config = await getAppConfig();
  const [trademarkKey, salesKey, historyKey] = await Promise.all([
    resolveProviderCredential(context.workspaceId, 'trademark'),
    resolveProviderCredential(context.workspaceId, 'comparable_sales'),
    resolveProviderCredential(context.workspaceId, 'domain_history'),
  ]);
  const trademarkProvider = getTrademarkProvider(config.trademarkProvider, config.providerEndpoints.trademark, trademarkKey);
  const salesProvider = getComparableSalesProvider(config.comparableSalesProvider, config.providerEndpoints.comparableSales, salesKey);
  const historyProvider = getHistoryProvider(config.historyProvider, config.providerEndpoints.history, historyKey);
  const [trademark, comparableSales, history] = await Promise.all([
    observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.trademark', correlationId: domain.id, metadata: { mode: trademarkProvider.mode } }, () => trademarkProvider.check(domain.name)),
    observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.comparable_sales', correlationId: domain.id, metadata: { mode: salesProvider.mode } }, () => salesProvider.search(domain.name)),
    observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.history', correlationId: domain.id, metadata: { mode: historyProvider.mode } }, () => historyProvider.check(domain.name, domain.opportunity?.score)),
  ]);

  await prisma.$transaction([
    prisma.trademarkCheck.create({
      data: {
        domainId: domain.id,
        riskLevel: riskLevel(trademark.riskLevel),
        matches: trademark.matches as unknown as Prisma.InputJsonValue,
        disclaimer: `${trademark.disclaimer} Provider: ${trademarkProvider.label}${trademark.stale ? ' (stale cache)' : ''}.`,
      },
    }),
    prisma.domainHistoryCheck.create({
      data: {
        domainId: domain.id,
        riskLevel: riskLevel(history.riskLevel),
        flags: history.flags,
        evidence: [...history.evidence, `Provider: ${historyProvider.label}${history.stale ? ' (stale cache)' : ''}.`],
        checkedAt: new Date(history.checkedAt),
      },
    }),
    ...comparableSales.sales.map((sale) =>
      prisma.comparableSale.upsert({
        where: { subjectDomain_domain_price_saleDate: { subjectDomain: domain.name, domain: sale.domain, price: new Prisma.Decimal(sale.price), saleDate: new Date(sale.saleDate) } },
        update: {
          marketplace: sale.marketplace,
          industry: sale.industry,
          metadata: { subjectDomain: domain.name, provider: salesProvider.label, stale: comparableSales.stale },
        },
        create: {
          subjectDomain: domain.name,
          domain: sale.domain,
          tld: sale.tld,
          price: new Prisma.Decimal(sale.price),
          saleDate: new Date(sale.saleDate),
          marketplace: sale.marketplace,
          industry: sale.industry,
          metadata: { subjectDomain: domain.name, provider: salesProvider.label, stale: comparableSales.stale },
        },
      }),
    ),
  ]);

  return { trademarkMatches: trademark.matches.length, comparableSales: comparableSales.sales.length, historyRisk: history.riskLevel };
}

export async function runWorkspaceHistoryChecks(context: WorkspaceContext, limit = 8): Promise<number> {
  assertWorkspaceWriter(context);
  return withEntitlementUsage(context.workspaceId, 'due_diligence_checks', limit, () => executeWorkspaceHistoryChecks(context, limit), (count) => count);
}

async function executeWorkspaceHistoryChecks(context: WorkspaceContext, limit: number): Promise<number> {
  const config = await getAppConfig();
  const apiKey = await resolveProviderCredential(context.workspaceId, 'domain_history');
  const provider = getHistoryProvider(config.historyProvider, config.providerEndpoints.history, apiKey);
  const opportunities = await prisma.domainOpportunity.findMany({
    where: { workspaceId: context.workspaceId, status: 'ACTIVE' },
    orderBy: { score: 'desc' },
    take: limit,
    select: { score: true, domain: { select: { id: true, name: true } } },
  });

  const results = await observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.history_batch', metadata: { mode: provider.mode, count: opportunities.length } }, () => Promise.all(opportunities.map(async (opportunity) => ({
    domainId: opportunity.domain.id,
    result: await provider.check(opportunity.domain.name, opportunity.score),
  }))));
  await prisma.$transaction(results.map(({ domainId, result }) => prisma.domainHistoryCheck.create({
    data: {
      domainId,
      riskLevel: riskLevel(result.riskLevel),
      flags: result.flags,
      evidence: [...result.evidence, `Provider: ${provider.label}${result.stale ? ' (stale cache)' : ''}.`],
      checkedAt: new Date(result.checkedAt),
    },
  })));
  return results.length;
}
