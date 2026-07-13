import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type OutreachCampaignView = {
  id: string;
  name: string;
  status: string;
  messageCount: number;
  approvedCount: number;
  messages: Array<{
    id: string;
    subject: string;
    body: string;
    status: string;
    approvedAt: Date | null;
  }>;
};

export async function getOutreachCampaigns(): Promise<OutreachCampaignView[]> {
  const context = await requireWorkspaceContext();

  const [campaigns, messages] = await Promise.all([
    prisma.outreachCampaign.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { name: 'asc' },
    }),
    prisma.outreachMessage.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: [{ approvedAt: 'desc' }, { subject: 'asc' }],
    }),
  ]);

  const messagesByCampaign = new Map<string, typeof messages>();
  for (const message of messages) {
    const key = message.campaignId ?? 'uncategorized';
    messagesByCampaign.set(key, [...(messagesByCampaign.get(key) ?? []), message]);
  }

  return campaigns.map((campaign) => {
    const campaignMessages = messagesByCampaign.get(campaign.id) ?? [];

    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      messageCount: campaignMessages.length,
      approvedCount: campaignMessages.filter((message) => Boolean(message.approvedAt)).length,
      messages: campaignMessages.map((message) => ({
        id: message.id,
        subject: message.subject,
        body: message.body,
        status: message.status,
        approvedAt: message.approvedAt,
      })),
    };
  });
}
