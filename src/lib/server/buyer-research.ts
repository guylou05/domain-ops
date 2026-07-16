import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type BuyerResearchView = {
  id: string;
  companyName: string;
  website: string | null;
  industry: string;
  location: string | null;
  reasonForFit: string;
  relevanceScore: number;
  outreachStatus: string;
  domain: string;
  opportunityScore: number | null;
  contacts: Array<{
    id: string;
    name: string | null;
    title: string | null;
    email: string | null;
    linkedinUrl: string | null;
    status: string;
    doNotContact: boolean;
  }>;
};

export async function getBuyerResearch(): Promise<BuyerResearchView[]> {
  const context = await requireWorkspaceContext();

  const buyers = await prisma.buyer.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: [{ relevanceScore: 'desc' }, { companyName: 'asc' }],
    include: {
      contacts: true,
      domain: {
        include: {
          opportunity: true,
        },
      },
    },
  });

  return buyers.map((buyer) => ({
    id: buyer.id,
    companyName: buyer.companyName,
    website: buyer.website,
    industry: buyer.industry,
    location: buyer.location,
    reasonForFit: buyer.reasonForFit,
    relevanceScore: buyer.relevanceScore,
    outreachStatus: buyer.outreachStatus,
    domain: buyer.domain.name,
    opportunityScore: buyer.domain.opportunity?.score ?? null,
    contacts: buyer.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      email: contact.email,
      linkedinUrl: contact.linkedinUrl,
      status: contact.status,
      doNotContact: contact.doNotContact,
    })),
  }));
}

export async function getBuyerDetail(id: string) {
  const context = await requireWorkspaceContext();
  return prisma.buyer.findFirst({ where: { id, workspaceId: context.workspaceId }, include: { domain: true, contacts: { orderBy: { createdAt: 'asc' } }, activities: { orderBy: { occurredAt: 'desc' }, take: 100 } } });
}

export async function getBuyerDomainOptions() {
  const context = await requireWorkspaceContext();
  return prisma.domain.findMany({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 250 });
}
