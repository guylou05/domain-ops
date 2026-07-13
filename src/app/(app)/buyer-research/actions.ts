'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

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

export async function generateBuyerTargets(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const opportunities = await prisma.domainOpportunity.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: 'ACTIVE',
      domain: {
        buyers: {
          none: {
            workspaceId: context.workspaceId,
          },
        },
      },
    },
    orderBy: { score: 'desc' },
    take: 5,
    include: {
      domain: true,
    },
  });

  for (const [index, opportunity] of opportunities.entries()) {
    const stem = titleCase(domainStem(opportunity.domain.name));
    const companyName = `${stem} Labs`;

    const buyer = await prisma.buyer.create({
      data: {
        workspaceId: context.workspaceId,
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

  revalidatePath('/buyer-research');
  revalidatePath('/outreach');
  revalidatePath('/overview');
  redirect('/buyer-research');
}
