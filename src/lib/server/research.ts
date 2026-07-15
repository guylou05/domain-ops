import { prisma } from '@/lib/prisma';
import { getAppConfig } from './app-config';
import { getProviderGovernanceView } from './provider-governance';
import { requireWorkspaceContext } from './workspace-context';

export async function getResearchView(filters: { subject?: string; marketplace?: string; source?: string; batch?: string }) {
  const context = await requireWorkspaceContext();
  const subject = filters.subject?.trim().toLowerCase() ?? '';
  const marketplace = filters.marketplace?.trim() ?? '';
  const source = filters.source?.trim() ?? '';
  const [sales, domains, batch, evidence, consent, usage, config] = await Promise.all([
    prisma.comparableSale.findMany({
      where: { workspaceId: context.workspaceId, ...(subject ? { subjectDomain: { contains: subject, mode: 'insensitive' } } : {}), ...(marketplace ? { marketplace: { contains: marketplace, mode: 'insensitive' } } : {}), ...(source ? { source } : {}) },
      orderBy: { saleDate: 'desc' }, take: 100,
    }),
    prisma.domain.findMany({ where: { workspaceId: context.workspaceId, status: 'ACTIVE', opportunity: { isNot: null } }, select: { name: true }, orderBy: { name: 'asc' }, take: 250 }),
    filters.batch ? prisma.comparableSaleImportBatch.findFirst({ where: { id: filters.batch, workspaceId: context.workspaceId } }) : null,
    prisma.publicBusinessEvidence.findMany({ where: { workspaceId: context.workspaceId, ...(subject ? { subjectDomain: subject } : {}) }, orderBy: { fetchedAt: 'desc' }, take: 30 }),
    prisma.researchConsent.findFirst({ where: { workspaceId: context.workspaceId, provider: 'sec_edgar', policyVersion: 'sec-edgar-v1', revokedAt: null } }),
    getProviderGovernanceView(context.workspaceId),
    getAppConfig(),
  ]);
  return { context, sales, domains, batch, evidence, consent, usage, config };
}
