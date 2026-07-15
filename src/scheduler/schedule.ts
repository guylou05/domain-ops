import { JobStatus, Status } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AppConfig, JobScheduleConfig } from '@/lib/server/app-config';
import type { WorkerTaskType } from '@/worker/task-registry';
import { isScheduleDue } from './cadence';

type RecurringTask = {
  type: WorkerTaskType;
  schedule: JobScheduleConfig;
};

export type ScheduleResult = {
  scannedWorkspaces: number;
  queuedJobs: number;
};

function recurringTasks(config: AppConfig): RecurringTask[] {
  const tasks: RecurringTask[] = [
    { type: 'daily_opportunity_digest', schedule: config.jobSchedules.dailyOpportunityDigest },
    { type: 'buyer_research_refresh', schedule: config.jobSchedules.buyerResearchRefresh },
    { type: 'portfolio_snapshot', schedule: config.jobSchedules.portfolioSnapshot },
    { type: 'renewal_reminders', schedule: config.jobSchedules.renewalReminders },
  ];
  return tasks.filter((task) => task.schedule.enabled);
}

export async function enqueueDueJobs(config: AppConfig, now = new Date()): Promise<ScheduleResult> {
  if (!config.schedulerEnabled) return { scannedWorkspaces: 0, queuedJobs: 0 };

  const tasks = recurringTasks(config);
  if (tasks.length === 0) return { scannedWorkspaces: 0, queuedJobs: 0 };

  const workspaces = await prisma.workspace.findMany({
    where: { status: Status.ACTIVE },
    select: { id: true },
  });
  const taskTypes = tasks.map((task) => task.type);
  const latestJobs = await prisma.backgroundJob.groupBy({
    by: ['workspaceId', 'type'],
    where: {
      workspaceId: { in: workspaces.map((workspace) => workspace.id) },
      type: { in: taskTypes },
    },
    _max: { createdAt: true },
  });

  const latestByWorkspaceAndType = new Map<string, Date>();
  for (const job of latestJobs) {
    const key = `${job.workspaceId}:${job.type}`;
    if (job._max.createdAt) latestByWorkspaceAndType.set(key, job._max.createdAt);
  }

  const dueJobs = workspaces.flatMap((workspace) =>
    tasks
      .filter((task) => isScheduleDue(latestByWorkspaceAndType.get(`${workspace.id}:${task.type}`) ?? null, task.schedule.intervalMinutes, now))
      .map((task) => ({
        workspaceId: workspace.id,
        type: task.type,
        status: JobStatus.QUEUED,
        payload: { source: 'recurring-scheduler', scheduledAt: now.toISOString() },
      })),
  );

  if (dueJobs.length > 0) await prisma.backgroundJob.createMany({ data: dueJobs });
  return { scannedWorkspaces: workspaces.length, queuedJobs: dueJobs.length };
}
