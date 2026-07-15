import { JobStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateAnalyzeAndPersist } from './domain-workflows';
import { requireWorkspaceContext, type WorkspaceContext } from './workspace-context';
import { nextDiscoveryRun } from '@/lib/discovery-cadence';
export { nextDiscoveryRun } from '@/lib/discovery-cadence';

export const DISCOVERY_SOURCES = ['MANUAL', 'GENERATED', 'EXPIRED', 'AUCTION', 'CLOSEOUT', 'TREND', 'EXTERNAL_PROVIDER'] as const;
export type DiscoverySourceType = (typeof DISCOVERY_SOURCES)[number];

type Criteria = { query?: string; industry?: string; keywords?: string[]; tlds?: string[]; count?: number };
function criteriaObject(value: Prisma.JsonValue): Criteria {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Criteria : {};
}

export async function executeDiscoveryJob(jobId: string): Promise<number> {
  const job = await prisma.discoveryJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === JobStatus.CANCELLED) return 0;
  await prisma.discoveryJob.update({ where: { id: job.id }, data: { status: JobStatus.RUNNING, progress: 10, startedAt: new Date(), error: null } });
  try {
    const criteria = criteriaObject(job.criteria);
    const context: WorkspaceContext = { userId: job.createdById, workspaceId: job.workspaceId, role: 'MEMBER', emailVerified: true, authSessionId: 'background-discovery', stepUpAt: null };
    const source = DISCOVERY_SOURCES.includes(job.source as DiscoverySourceType) ? job.source as DiscoverySourceType : 'GENERATED';
    const label = source.toLowerCase().replaceAll('_', ' ');
    const results = await generateAnalyzeAndPersist(context, {
      concept: criteria.query?.trim() || `${label} domains`, industry: criteria.industry?.trim() || 'general',
      keywords: criteria.keywords?.length ? criteria.keywords : [label.replaceAll(' ', ''), 'brand'],
      tlds: criteria.tlds?.length ? criteria.tlds : ['.com'], count: Math.min(Math.max(criteria.count ?? 8, 3), 25), maxLength: 22,
    }, `DISCOVERY_${source}`);
    await prisma.discoveryJob.updateMany({
      where: { id: job.id, status: JobStatus.RUNNING },
      data: { status: JobStatus.COMPLETED, progress: 100, resultCount: results.length, completedAt: new Date() },
    });
    return results.length;
  } catch (error) {
    await prisma.discoveryJob.updateMany({
      where: { id: job.id, status: JobStatus.RUNNING },
      data: { status: JobStatus.FAILED, progress: 100, error: error instanceof Error ? error.message : 'Discovery failed.', completedAt: new Date() },
    });
    throw error;
  }
}

export async function runDueSavedSearchesForWorkspace(workspaceId: string, now = new Date()): Promise<number> {
  const queued = await prisma.discoveryJob.findMany({ where: { workspaceId, status: JobStatus.QUEUED }, orderBy: { createdAt: 'asc' }, take: 10 });
  let results = 0;
  for (const job of queued) {
    results += await executeDiscoveryJob(job.id);
    if (job.savedSearchId) {
      const search = await prisma.savedSearch.findFirst({ where: { id: job.savedSearchId, workspaceId } });
      if (search) await prisma.savedSearch.update({ where: { id: search.id }, data: { lastRunAt: now, nextRunAt: nextDiscoveryRun(search.schedule, now) } });
    }
  }
  const searches = await prisma.savedSearch.findMany({ where: { workspaceId, status: 'ACTIVE', schedule: { in: ['DAILY', 'WEEKLY'] }, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] } });
  for (const search of searches) {
    const job = await prisma.discoveryJob.create({ data: { workspaceId, createdById: search.createdById, savedSearchId: search.id, source: search.source, criteria: search.criteria as Prisma.InputJsonValue, status: JobStatus.QUEUED } });
    results += await executeDiscoveryJob(job.id);
    await prisma.savedSearch.update({ where: { id: search.id }, data: { lastRunAt: now, nextRunAt: nextDiscoveryRun(search.schedule, now) } });
  }
  return results;
}

export async function getDiscoveryView(batchId?: string) {
  const context = await requireWorkspaceContext();
  const [searches, jobs, sources, batch] = await Promise.all([
    prisma.savedSearch.findMany({ where: { workspaceId: context.workspaceId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }),
    prisma.discoveryJob.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.discoverySource.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } }),
    batchId ? prisma.importBatch.findFirst({ where: { id: batchId, workspaceId: context.workspaceId } }) : null,
  ]);
  return { context, searches, jobs, sources, batch };
}
