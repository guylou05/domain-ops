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
    name: string | null;
    title: string | null;
    email: string | null;
    linkedinUrl: string | null;
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
      name: contact.name,
      title: contact.title,
      email: contact.email,
      linkedinUrl: contact.linkedinUrl,
    })),
  }));
}
