'use server';

import { RiskLevel } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

function riskForScore(score: number): RiskLevel {
  if (score >= 82) return RiskLevel.LOW;
  if (score >= 68) return RiskLevel.MODERATE;
  return RiskLevel.HIGH;
}

export async function runHistoryChecks(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const opportunities = await prisma.domainOpportunity.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: 'ACTIVE',
      domain: {
        historyChecks: { none: {} },
      },
    },
    orderBy: { score: 'desc' },
    take: 8,
    include: {
      domain: true,
    },
  });

  for (const opportunity of opportunities) {
    const riskLevel = riskForScore(opportunity.score);
    await prisma.domainHistoryCheck.create({
      data: {
        domainId: opportunity.domainId,
        riskLevel,
        flags:
          riskLevel === RiskLevel.LOW
            ? ['No obvious historical abuse patterns in deterministic check']
            : ['Manual archive review recommended before acquisition', 'Prior ownership signal requires verification'],
        evidence: [
          `Generated from workspace opportunity score ${opportunity.score}.`,
          `Source workflow: ${opportunity.domain.source}.`,
          'Development check uses deterministic internal signals until a live history provider is configured.',
        ],
      },
    });
  }

  revalidatePath('/expired-domains');
  revalidatePath('/opportunities');
  revalidatePath('/overview');
  redirect('/expired-domains');
}
