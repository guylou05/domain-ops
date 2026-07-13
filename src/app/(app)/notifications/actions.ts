'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';

function readNotificationId(formData: FormData): string {
  const id = String(formData.get('notificationId') ?? '').trim();
  if (!id) throw new Error('notificationId is required.');
  return id;
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext();
  const notificationId = readNotificationId(formData);

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath('/notifications');
  revalidatePath('/overview');
}

export async function markAllNotificationsRead(): Promise<void> {
  const context = await requireWorkspaceContext();

  await prisma.notification.updateMany({
    where: {
      workspaceId: context.workspaceId,
      userId: context.userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidatePath('/notifications');
  revalidatePath('/overview');
}
