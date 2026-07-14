import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type AdminDashboard = {
  role: string;
  canAdminister: boolean;
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
    attempts: number;
    error: string | null;
    lockedBy: string | null;
    lockExpiresAt: Date | null;
    updatedAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: Date;
  }>;
  featureFlags: Array<{
    key: string;
    enabled: boolean;
    description: string | null;
  }>;
  counts: {
    users: number;
    activeDomains: number;
    activeOpportunities: number;
    activeJobs: number;
  };
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const context = await requireWorkspaceContext();
  const canAdminister = context.role === 'OWNER' || context.role === 'ADMIN';

  const [users, activeDomains, activeOpportunities, activeJobs, jobs, auditLogs, featureFlags] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId: context.workspaceId } }),
    prisma.domain.count({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' } }),
    prisma.domainOpportunity.count({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' } }),
    prisma.backgroundJob.count({ where: { workspaceId: context.workspaceId, status: { in: ['QUEUED', 'RUNNING'] } } }),
    prisma.backgroundJob.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        attempts: true,
        error: true,
        lockedBy: true,
        lockExpiresAt: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
      },
    }),
    prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      select: {
        key: true,
        enabled: true,
        description: true,
      },
    }),
  ]);

  return {
    role: context.role,
    canAdminister,
    jobs,
    auditLogs,
    featureFlags,
    counts: {
      users,
      activeDomains,
      activeOpportunities,
      activeJobs,
    },
  };
}
