import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for query profiling.');

const prisma = new PrismaClient();
const maxExecutionMs = Number(process.env.PERF_QUERY_MAX_MS ?? 100);
if (!Number.isFinite(maxExecutionMs) || maxExecutionMs <= 0) throw new Error('PERF_QUERY_MAX_MS must be a positive number.');
const profiles = [
  {
    name: 'ranked workspace opportunities',
    sql: `SELECT "id" FROM "DomainOpportunity" WHERE "workspaceId" = (SELECT "id" FROM "Workspace" ORDER BY "createdAt" LIMIT 1) ORDER BY "score" DESC LIMIT 50`,
  },
  {
    name: 'recent operational events',
    sql: `SELECT "id" FROM "OperationalEvent" WHERE "workspaceId" = (SELECT "id" FROM "Workspace" ORDER BY "createdAt" LIMIT 1) ORDER BY "occurredAt" DESC LIMIT 80`,
  },
  {
    name: 'available background jobs',
    sql: `SELECT "id" FROM "BackgroundJob" WHERE "status" = 'QUEUED' AND ("lockExpiresAt" IS NULL OR "lockExpiresAt" < NOW()) ORDER BY "createdAt" LIMIT 20`,
  },
];

try {
  console.log(`DomainScout AI query profiles (budget: ${maxExecutionMs} ms each)`);
  const failures = [];
  for (const profile of profiles) {
    const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${profile.sql}`);
    const document = rows[0]['QUERY PLAN'][0];
    const executionMs = Number(document['Execution Time']);
    const planningMs = Number(document['Planning Time']);
    console.log(`${profile.name}: planning=${planningMs.toFixed(3)}ms execution=${executionMs.toFixed(3)}ms root=${document.Plan['Node Type']}`);
    if (!Number.isFinite(executionMs) || executionMs > maxExecutionMs) failures.push(`${profile.name} (${executionMs} ms)`);
  }
  if (failures.length) throw new Error(`Query budget exceeded: ${failures.join(', ')}.`);
  console.log('Query performance budgets passed.');
} finally {
  await prisma.$disconnect();
}
