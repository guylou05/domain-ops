import { createClient } from 'redis';
import { prisma } from '@/lib/prisma';
import { getAppConfig } from '@/lib/server/app-config';
import { runQueuedJobs } from '@/worker/runner';
import { readWorkerId } from '@/worker/lease';
import { withRedisLock } from './redis-lock';
import { enqueueDueJobs } from './schedule';

const SCHEDULER_LOCK_KEY = 'domainscout:scheduler:recurring-jobs';
let stopping = false;
let wakeScheduler: (() => void) | null = null;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      wakeScheduler = null;
      resolve();
    }, milliseconds);
    wakeScheduler = () => {
      clearTimeout(timeout);
      wakeScheduler = null;
      resolve();
    };
  });
}

async function runCycle(client: ReturnType<typeof createClient>): Promise<number> {
  const config = await getAppConfig();

  if (config.schedulerEnabled) {
    const lock = await withRedisLock(client, SCHEDULER_LOCK_KEY, Math.max(config.schedulerPollMs * 2, 30000), () =>
      enqueueDueJobs(config),
    );
    if (lock.acquired && lock.value) {
      console.log(`Scheduler scanned ${lock.value.scannedWorkspaces} workspaces and queued ${lock.value.queuedJobs} jobs.`);
    } else if (!lock.acquired) {
      console.log('Another scheduler replica owns this cycle.');
    }
  } else {
    console.log('Recurring scheduling is disabled in Runtime Settings.');
  }

  const results = await runQueuedJobs(config.workerJobLimit, readWorkerId(), config.workerLeaseMs);
  for (const result of results) console.log(`${result.status} ${result.type} ${result.id}: ${result.message}`);
  if (results.length === 0) console.log('No queued background jobs found.');

  return config.schedulerPollMs;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the scheduler.');
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for distributed recurring scheduling.');

  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => console.error('Redis error:', error.message));
  await client.connect();
  console.log(`DomainScout AI scheduler connected. Worker id: ${readWorkerId()}.`);

  try {
    do {
      const pollMs = await runCycle(client);
      if (process.argv.includes('--once') || stopping) break;
      await delay(pollMs);
    } while (!stopping);
  } finally {
    if (client.isOpen) await client.quit();
  }
}

function stop() {
  stopping = true;
  wakeScheduler?.();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
