import { prisma } from '@/lib/prisma';
import { getAppConfig } from '@/lib/server/app-config';
import { readLeaseMs, readWorkerId } from './lease';
import { getRegisteredWorkerTasks } from './task-registry';
import { runQueuedJobs } from './runner';

export { runBackgroundJob, runQueuedJobs } from './runner';
export { nextLeaseExpiry, readLeaseMs, readWorkerId } from './lease';
export { getRegisteredWorkerTasks, isWorkerTaskType, registeredTasks } from './task-registry';

async function main() {
  const tasks = getRegisteredWorkerTasks();
  console.log(`DomainScout AI worker ready. Registered tasks: ${tasks.map((task) => task.type).join(', ')}`);

  if (process.argv.includes('--list')) {
    for (const task of tasks) {
      console.log(`${task.type}: ${task.description}`);
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to process queued background jobs. Run npm run worker -- --list to inspect registered tasks without a database.');
  }

  const config = await getAppConfig();
  const envLimit = Number(process.env.WORKER_JOB_LIMIT);
  const limit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : config.workerJobLimit;
  const workerId = readWorkerId();
  const leaseMs = process.env.WORKER_LEASE_MS ? readLeaseMs() : config.workerLeaseMs;
  console.log(`Worker id: ${workerId}. Lease duration: ${leaseMs}ms.`);

  const results = await runQueuedJobs(Number.isFinite(limit) && limit > 0 ? limit : 5, workerId, leaseMs);
  if (results.length === 0) {
    console.log('No queued background jobs found.');
    return;
  }

  for (const result of results) {
    console.log(`${result.status} ${result.type} ${result.id}: ${result.message}`);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
