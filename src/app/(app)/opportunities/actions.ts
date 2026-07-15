'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { runDomainDueDiligence } from '@/lib/server/due-diligence';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

const DEFAULT_WATCHLIST_NAME = 'Opportunity shortlist';

function normalizeDomain(value: FormDataEntryValue | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0] ?? '';
}

export async function runOpportunityDueDiligence(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);
  const domainName = normalizeDomain(formData.get('domain'));
  if (!domainName) throw new Error('Domain is required.');

  try {
    const result = await runDomainDueDiligence(context, domainName);
    await recordAuditEvent(context, {
      action: 'domain.due_diligence_completed',
      targetType: 'Domain',
      targetId: domainName,
      metadata: result,
    });
    revalidatePath(`/opportunities/${encodeURIComponent(domainName)}`);
    revalidatePath('/expired-domains');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run due diligence.';
    redirect(`/opportunities/${encodeURIComponent(domainName)}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/opportunities/${encodeURIComponent(domainName)}?notice=${encodeURIComponent('Due diligence completed.')}`);
}

export async function addOpportunityToWatchlist(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  const domainName = normalizeDomain(formData.get('domain'));
  if (!domainName) throw new Error('Domain is required.');

  const domain = await prisma.domain.findFirst({
    where: {
      workspaceId: context.workspaceId,
      name: domainName,
      opportunity: { status: 'ACTIVE' },
    },
    select: { id: true, name: true },
  });

  if (!domain) throw new Error('Opportunity was not found in this workspace.');

  const watchlist =
    (await prisma.watchlist.findFirst({
      where: {
        workspaceId: context.workspaceId,
        name: DEFAULT_WATCHLIST_NAME,
        status: 'ACTIVE',
      },
      select: { id: true },
    })) ??
    (await prisma.watchlist.create({
      data: {
        workspaceId: context.workspaceId,
        name: DEFAULT_WATCHLIST_NAME,
        notes: 'Saved opportunities that are ready for acquisition review.',
      },
      select: { id: true },
    }));

  await prisma.watchlistItem.upsert({
    where: {
      watchlistId_domainId: {
        watchlistId: watchlist.id,
        domainId: domain.id,
      },
    },
    update: {},
    create: {
      watchlistId: watchlist.id,
      domainId: domain.id,
      notes: 'Saved from opportunities.',
      tags: ['opportunity'],
    },
  });

  revalidatePath('/opportunities');
  revalidatePath(`/opportunities/${encodeURIComponent(domain.name)}`);
  revalidatePath('/overview');
  revalidatePath('/watchlists');
  redirect('/watchlists');
}

export async function bulkOpportunityAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);
  const selected = formData.getAll('opportunityId').map(String).filter(Boolean).slice(0, 100);
  if (!selected.length) throw new Error('Select at least one opportunity.');
  const opportunities = await prisma.domainOpportunity.findMany({
    where: { id: { in: selected }, workspaceId: context.workspaceId, status: 'ACTIVE' },
    include: { domain: { select: { id: true, name: true } } },
  });
  if (!opportunities.length) throw new Error('No selected opportunities were found in this workspace.');
  const intent = String(formData.get('intent') ?? '');
  if (intent === 'compare') {
    redirect(`/opportunities?compare=${encodeURIComponent(opportunities.map((item) => item.domain.name).join(','))}`);
  }
  if (intent === 'approve') {
    await prisma.domainOpportunity.updateMany({ where: { id: { in: opportunities.map((item) => item.id) }, workspaceId: context.workspaceId }, data: { approvalStatus: 'APPROVED', approvedAt: new Date(), approvedById: context.userId } });
    await recordAuditEvent(context, { action: 'opportunity.bulk_approved', targetType: 'DomainOpportunity', metadata: { count: opportunities.length } });
  } else if (intent === 'watchlist') {
    const watchlist = (await prisma.watchlist.findFirst({ where: { workspaceId: context.workspaceId, name: DEFAULT_WATCHLIST_NAME, status: 'ACTIVE' } })) ?? await prisma.watchlist.create({ data: { workspaceId: context.workspaceId, name: DEFAULT_WATCHLIST_NAME, notes: 'Saved opportunities that are ready for acquisition review.' } });
    for (const opportunity of opportunities) await prisma.watchlistItem.upsert({ where: { watchlistId_domainId: { watchlistId: watchlist.id, domainId: opportunity.domain.id } }, update: {}, create: { watchlistId: watchlist.id, domainId: opportunity.domain.id, notes: 'Added by bulk review.', tags: ['opportunity', 'bulk-review'] } });
    await recordAuditEvent(context, { action: 'opportunity.bulk_watchlisted', targetType: 'DomainOpportunity', metadata: { count: opportunities.length } });
  } else {
    throw new Error('Bulk action is invalid.');
  }
  revalidatePath('/opportunities'); revalidatePath('/watchlists'); revalidatePath('/overview');
}
