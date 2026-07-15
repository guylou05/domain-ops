import { Prisma, RiskLevel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getComparableSalesProvider } from '@/lib/providers/comparable-sales';
import { getHistoryProvider } from '@/lib/providers/history';
import { getTrademarkProvider } from '@/lib/providers/trademark';
import { getPublicBusinessProvider, PUBLIC_BUSINESS_POLICY_VERSION } from '@/lib/providers/public-business';
import { getAppConfig } from './app-config';
import { withEntitlementUsage } from './entitlements';
import { resolveProviderCredential } from './provider-credentials';
import { assertWorkspaceWriter, type WorkspaceContext } from './workspace-context';
import { observeOperationalCall } from './observability';
import { runGovernedProviderCall } from './provider-governance';

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
  const publicProvider = getPublicBusinessProvider(config.publicBusinessProvider, config.providerEndpoints.publicBusiness, config.publicBusinessContact);
  const publicConsent = config.publicBusinessProvider !== 'live' || Boolean(await prisma.researchConsent.findFirst({ where: { workspaceId: context.workspaceId, provider: 'sec_edgar', policyVersion: PUBLIC_BUSINESS_POLICY_VERSION, revokedAt: null } }));
  const [trademarkCall, salesCall, historyCall, publicCall] = await Promise.allSettled([
    observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.trademark', correlationId: domain.id, metadata: { mode: trademarkProvider.mode } }, () => runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'trademark', cacheKey: domain.name, policy: config.providerPolicy, execute: () => trademarkProvider.check(domain.name), markStale: (value) => ({ ...value, stale: true }) })),
    observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.comparable_sales', correlationId: domain.id, metadata: { mode: salesProvider.mode } }, () => runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'comparable_sales', cacheKey: domain.name, policy: config.providerPolicy, execute: () => salesProvider.search(domain.name), markStale: (value) => ({ ...value, stale: true }) })),
    observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.history', correlationId: domain.id, metadata: { mode: historyProvider.mode } }, () => runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'domain_history', cacheKey: domain.name, policy: config.providerPolicy, execute: () => historyProvider.check(domain.name, domain.opportunity?.score), markStale: (value) => ({ ...value, stale: true }) })),
    publicConsent ? observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.public_business', correlationId: domain.id, metadata: { mode: publicProvider.mode } }, () => runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'public_business', cacheKey: domain.name, policy: config.providerPolicy, execute: () => publicProvider.search(domain.name), markStale: (value) => ({ ...value, stale: true }) })) : Promise.reject(new Error('Public-data consent required.')),
  ]);
  if ([trademarkCall, salesCall, historyCall].every((call) => call.status === 'rejected')) throw new Error('All due-diligence providers failed. Review provider health and credentials.');

  await prisma.$transaction(async (tx) => {
    if (trademarkCall.status === 'fulfilled') await tx.trademarkCheck.create({ data: { domainId: domain.id, riskLevel: riskLevel(trademarkCall.value.riskLevel), matches: trademarkCall.value.matches as unknown as Prisma.InputJsonValue, disclaimer: `${trademarkCall.value.disclaimer} Provider: ${trademarkProvider.label}${trademarkCall.value.stale ? ' (stale cache)' : ''}.` } });
    if (historyCall.status === 'fulfilled') await tx.domainHistoryCheck.create({ data: { domainId: domain.id, riskLevel: riskLevel(historyCall.value.riskLevel), flags: historyCall.value.flags, evidence: [...historyCall.value.evidence, `Provider: ${historyProvider.label}${historyCall.value.stale ? ' (stale cache)' : ''}.`], checkedAt: new Date(historyCall.value.checkedAt) } });
    if (salesCall.status === 'fulfilled') for (const sale of salesCall.value.sales) await tx.comparableSale.upsert({ where: { workspaceId_subjectDomain_domain_price_saleDate: { workspaceId: context.workspaceId, subjectDomain: domain.name, domain: sale.domain, price: new Prisma.Decimal(sale.price), saleDate: new Date(sale.saleDate) } }, update: { marketplace: sale.marketplace, industry: sale.industry, source: 'PROVIDER', checkedAt: new Date(salesCall.value.checkedAt), metadata: { provider: salesProvider.label, stale: salesCall.value.stale } }, create: { workspaceId: context.workspaceId, createdById: context.userId, subjectDomain: domain.name, domain: sale.domain, tld: sale.tld, price: new Prisma.Decimal(sale.price), saleDate: new Date(sale.saleDate), marketplace: sale.marketplace, industry: sale.industry, source: 'PROVIDER', checkedAt: new Date(salesCall.value.checkedAt), metadata: { provider: salesProvider.label, stale: salesCall.value.stale } } });
    if (publicCall.status === 'fulfilled') for (const match of publicCall.value.matches) await tx.publicBusinessEvidence.upsert({ where: { workspaceId_subjectDomain_provider_companyName_sourceUrl: { workspaceId: context.workspaceId, subjectDomain: domain.name, provider: publicProvider.label, companyName: match.companyName, sourceUrl: match.sourceUrl } }, update: { jurisdiction: match.jurisdiction, identifier: match.identifier, fetchedAt: new Date(publicCall.value.checkedAt), stale: publicCall.value.stale }, create: { workspaceId: context.workspaceId, subjectDomain: domain.name, provider: publicProvider.label, companyName: match.companyName, jurisdiction: match.jurisdiction, identifier: match.identifier, sourceUrl: match.sourceUrl, fetchedAt: new Date(publicCall.value.checkedAt), stale: publicCall.value.stale, metadata: { legalNotice: publicCall.value.legalNotice } } });
  });

  return { trademarkMatches: trademarkCall.status === 'fulfilled' ? trademarkCall.value.matches.length : 0, comparableSales: salesCall.status === 'fulfilled' ? salesCall.value.sales.length : 0, historyRisk: historyCall.status === 'fulfilled' ? historyCall.value.riskLevel : 'UNKNOWN', providerFailures: [trademarkCall, salesCall, historyCall, publicCall].filter((call) => call.status === 'rejected').length };
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

  const settled = await observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.history_batch', metadata: { mode: provider.mode, count: opportunities.length } }, () => Promise.allSettled(opportunities.map(async (opportunity) => ({
    domainId: opportunity.domain.id,
    result: await runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'domain_history', cacheKey: opportunity.domain.name, policy: config.providerPolicy, execute: () => provider.check(opportunity.domain.name, opportunity.score), markStale: (value) => ({ ...value, stale: true }) }),
  }))));
  const results = settled.filter((item): item is PromiseFulfilledResult<{ domainId: string; result: Awaited<ReturnType<typeof provider.check>> }> => item.status === 'fulfilled').map((item) => item.value);
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
