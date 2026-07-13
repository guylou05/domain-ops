import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type ExpiredDomainHistoryView = {
  id: string;
  domain: string;
  score: number | null;
  riskLevel: string;
  flags: string[];
  evidence: string[];
  checkedAt: Date;
};

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export async function getExpiredDomainHistory(): Promise<ExpiredDomainHistoryView[]> {
  const context = await requireWorkspaceContext();

  const checks = await prisma.domainHistoryCheck.findMany({
    where: {
      domain: { workspaceId: context.workspaceId },
    },
    orderBy: { checkedAt: 'desc' },
    include: {
      domain: {
        include: {
          opportunity: true,
        },
      },
    },
  });

  return checks.map((check) => ({
    id: check.id,
    domain: check.domain.name,
    score: check.domain.opportunity?.score ?? null,
    riskLevel: check.riskLevel,
    flags: toStringList(check.flags),
    evidence: toStringList(check.evidence),
    checkedAt: check.checkedAt,
  }));
}
