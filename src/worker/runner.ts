import { JobStatus, type BackgroundJob } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createDailyOpportunityDigestForWorkspace,
  createPortfolioSnapshotForWorkspace,
  generateBuyerTargetsForWorkspace,
} from '@/lib/server/workflow-generators';
import { nextLeaseExpiry, readLeaseMs, readWorkerId } from './lease';
import { isWorkerTaskType, type WorkerTaskType } from './task-registry';

export type JobRunResult = {
  id: string;
  type: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  message: string;
};

type RunnableJob = Pick<BackgroundJob, 'id' | 'workspaceId' | 'type'>;

const clearLease = {
  lockedAt: null,
  lockedBy: null,
  lockExpiresAt: null,
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

export async function runBackgroundJob(job: RunnableJob, workerId = readWorkerId()): Promise<JobRunResult> {
  if (!isWorkerTaskType(job.type)) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: `Unsupported worker task: ${job.type}`,
        progress: 100,
        ...clearLease,
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
      lockedBy: workerId,
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
        ...clearLease,
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
        ...clearLease,
      },
    });
    return { id: job.id, type: job.type, status: 'FAILED', message };
  }
}

export async function leaseQueuedJobs(limit = 5, workerId = readWorkerId(), leaseMs = readLeaseMs()): Promise<RunnableJob[]> {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
  const now = new Date();
  const expires = nextLeaseExpiry(now, leaseMs);
  const candidates = await prisma.backgroundJob.findMany({
    where: {
      status: JobStatus.QUEUED,
      OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: normalizedLimit * 3,
    select: { id: true },
  });

  const jobs: RunnableJob[] = [];
  for (const candidate of candidates) {
    if (jobs.length >= normalizedLimit) {
      break;
    }

    const claim = await prisma.backgroundJob.updateMany({
      where: {
        id: candidate.id,
        status: JobStatus.QUEUED,
        OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }],
      },
      data: {
        lockedAt: now,
        lockedBy: workerId,
        lockExpiresAt: expires,
      },
    });

    if (claim.count !== 1) {
      continue;
    }

    const job = await prisma.backgroundJob.findUnique({
      where: { id: candidate.id },
      select: { id: true, workspaceId: true, type: true },
    });
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

export async function runQueuedJobs(limit = 5, workerId = readWorkerId(), leaseMs = readLeaseMs()): Promise<JobRunResult[]> {
  const jobs = await leaseQueuedJobs(limit, workerId, leaseMs);
  const results: JobRunResult[] = [];
  for (const job of jobs) {
    results.push(await runBackgroundJob(job, workerId));
  }
  return results;
}
