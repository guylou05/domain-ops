import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export async function getOutreachWorkspace() {
  const context = await requireWorkspaceContext();
  const [campaigns, templates, tasks, contacts, suppressions] = await Promise.all([
    prisma.outreachCampaign.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { createdAt: 'desc' }, include: { messages: { orderBy: [{ sequenceStep: 'asc' }, { createdAt: 'desc' }], include: { buyer: true, contact: true, domain: true, deliveries: { orderBy: { occurredAt: 'desc' }, take: 3 } } } } }),
    prisma.outreachTemplate.findMany({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.outreachTask.findMany({ where: { workspaceId: context.workspaceId }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], take: 100 }),
    prisma.buyerContact.findMany({ where: { workspaceId: context.workspaceId, email: { not: null }, status: 'ACTIVE' }, include: { buyer: { include: { domain: true } } }, orderBy: { name: 'asc' } }),
    prisma.outreachSuppression.findMany({ where: { workspaceId: context.workspaceId, active: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  return { context, campaigns, templates, tasks, contacts, suppressions };
}

export async function getOutreachCampaigns() {
  const workspace = await getOutreachWorkspace();
  return workspace.campaigns.map((campaign) => ({ ...campaign, messageCount: campaign.messages.length, approvedCount: campaign.messages.filter((message) => Boolean(message.approvedAt)).length }));
}
