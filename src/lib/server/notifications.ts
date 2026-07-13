import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type NotificationView = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
};

export async function getNotifications(): Promise<NotificationView[]> {
  const context = await requireWorkspaceContext();

  return prisma.notification.findMany({
    where: {
      workspaceId: context.workspaceId,
      userId: context.userId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      readAt: true,
    },
  });
}
