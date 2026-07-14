import { JobStatus, type BackgroundJob } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createDailyOpportunityDigestForWorkspace,
  createPortfolioSnapshotForWorkspace,
  generateBuyerTargetsForWorkspace,
} from '@/lib/server/workflow-generators';
import { isWorkerTaskType, type WorkerTaskType } from './task-registry';

export type JobRunResult = {
  id: string;
  type: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  message: string;
};

async function executeTask(type: WorkerTaskType, workspaceId: string): Promise<string> {
  switch (type) {
    case 'daily_opportunity_digest': {
      const notifications = await createDailyOpportunityDigestForWorkspace(workspaceId);
      return `Created ${notifications} digest notifications.`;
    }
    case 'buyer_research_refresh': {
      const buyers = await generateBuyerTargetsForWorkspace(workspaceId);
      return `Created ${buyers} buyer research targets.`;
    }
    case 'portfolio_snapshot': {
      const reportId = await createPortfolioSnapshotForWorkspace(workspaceId);
      return `Created portfolio snapshot report ${reportId}.`;
    }
  }
}

export async function runBackgroundJob(job: Pick<BackgroundJob, 'id' | 'workspaceId' | 'type'>): Promise<JobRunResult> {
  if (!isWorkerTaskType(job.type)) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: `Unsupported worker task: ${job.type}`,
        progress: 100,
      },
    });
    return { id: job.id, type: job.type, status: 'FAILED', message: `Unsupported worker task: ${job.type}` };
  }

  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: JobStatus.RUNNING,
      progress: 10,
      attempts: { increment: 1 },
      error: null,
    },
  });

  try {
    const message = await executeTask(job.type, job.workspaceId);
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        progress: 100,
        error: null,
      },
    });
    return { id: job.id, type: job.type, status: 'COMPLETED', message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker task failed.';
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        progress: 100,
        error: message,
      },
    });
    return { id: job.id, type: job.type, status: 'FAILED', message };
  }
}

export async function runQueuedJobs(limit = 5): Promise<JobRunResult[]> {
  const jobs = await prisma.backgroundJob.findMany({
    where: { status: JobStatus.QUEUED },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const results: JobRunResult[] = [];
  for (const job of jobs) {
    results.push(await runBackgroundJob(job));
  }
  return results;
}
