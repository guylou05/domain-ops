'use server';

import { JobStatus, type Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { reviewDomainCsv, type ImportReviewRow } from '@/lib/csv-mobility';
import { DISCOVERY_SOURCES, executeDiscoveryJob, nextDiscoveryRun, type DiscoverySourceType } from '@/lib/server/discovery';
import { importAnalyzeAndPersist } from '@/lib/server/domain-workflows';
import { recordAuditEvent } from '@/lib/server/audit';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
function sourceValue(raw: string): DiscoverySourceType { return DISCOVERY_SOURCES.includes(raw as DiscoverySourceType) ? raw as DiscoverySourceType : 'GENERATED'; }
function criteria(data: FormData) { return { query: value(data, 'query'), industry: value(data, 'industry') || 'general', keywords: value(data, 'keywords').split(',').map((item) => item.trim()).filter(Boolean), tlds: value(data, 'tlds').split(',').map((item) => item.trim()).filter(Boolean), count: Math.min(Math.max(Number(data.get('count')) || 8, 3), 25) }; }

export async function createSavedSearch(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const name = value(formData, 'name'); if (name.length < 2) throw new Error('Saved search name is required.');
  const schedule = ['MANUAL', 'DAILY', 'WEEKLY'].includes(value(formData, 'schedule')) ? value(formData, 'schedule') : 'MANUAL';
  const search = await prisma.savedSearch.create({ data: { workspaceId: context.workspaceId, createdById: context.userId, name, source: sourceValue(value(formData, 'source')), schedule, criteria: criteria(formData), nextRunAt: nextDiscoveryRun(schedule) } });
  await recordAuditEvent(context, { action: 'discovery.search_created', targetType: 'SavedSearch', targetId: search.id, metadata: { schedule, source: search.source } });
  revalidatePath('/discovery');
}

export async function runDiscovery(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const source = sourceValue(value(formData, 'source'));
  const job = await prisma.discoveryJob.create({ data: { workspaceId: context.workspaceId, createdById: context.userId, source, criteria: criteria(formData), status: JobStatus.QUEUED } });
  await recordAuditEvent(context, { action: 'discovery.job_started', targetType: 'DiscoveryJob', targetId: job.id, metadata: { source } });
  await executeDiscoveryJob(job.id);
  revalidatePath('/discovery'); revalidatePath('/opportunities'); revalidatePath('/overview');
}

export async function runSavedSearch(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = value(formData, 'id');
  const search = await prisma.savedSearch.findFirst({ where: { id, workspaceId: context.workspaceId, status: 'ACTIVE' } }); if (!search) throw new Error('Saved search was not found.');
  const job = await prisma.discoveryJob.create({ data: { workspaceId: context.workspaceId, createdById: context.userId, savedSearchId: search.id, source: search.source, criteria: search.criteria as Prisma.InputJsonValue, status: JobStatus.QUEUED } });
  await prisma.backgroundJob.create({ data: { workspaceId: context.workspaceId, type: 'scheduled_discovery', status: JobStatus.QUEUED, payload: { discoveryJobId: job.id, source: 'saved-search-run' } } });
  await recordAuditEvent(context, { action: 'discovery.search_queued', targetType: 'SavedSearch', targetId: id, metadata: { jobId: job.id } });
  revalidatePath('/discovery');
}

export async function cancelDiscoveryJob(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = value(formData, 'id');
  const result = await prisma.discoveryJob.updateMany({ where: { id, workspaceId: context.workspaceId, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } }, data: { status: JobStatus.CANCELLED, cancelledAt: new Date(), progress: 100 } });
  if (result.count) await recordAuditEvent(context, { action: 'discovery.job_cancelled', targetType: 'DiscoveryJob', targetId: id });
  revalidatePath('/discovery');
}

export async function archiveSavedSearch(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = value(formData, 'id');
  await prisma.savedSearch.updateMany({ where: { id, workspaceId: context.workspaceId }, data: { status: 'ARCHIVED', nextRunAt: null } });
  await recordAuditEvent(context, { action: 'discovery.search_archived', targetType: 'SavedSearch', targetId: id }); revalidatePath('/discovery');
}

export async function reviewCsvUpload(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const file = formData.get('file'); if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) throw new Error('Select a CSV file.');
  if (file.size > 2_000_000) throw new Error('CSV files must be 2 MB or smaller.');
  const existing = await prisma.domain.findMany({ where: { workspaceId: context.workspaceId }, select: { name: true } });
  const rows = reviewDomainCsv(await file.text(), existing.map((item) => item.name));
  const batch = await prisma.importBatch.create({ data: { workspaceId: context.workspaceId, createdById: context.userId, filename: file.name.slice(0, 255), industry: value(formData, 'industry') || 'general', totalRows: rows.length, validRows: rows.filter((row) => row.status === 'VALID').length, duplicateRows: rows.filter((row) => row.status === 'DUPLICATE').length, errorRows: rows.filter((row) => row.status === 'ERROR').length, rows } });
  await recordAuditEvent(context, { action: 'import.csv_reviewed', targetType: 'ImportBatch', targetId: batch.id, metadata: { filename: batch.filename, validRows: batch.validRows } });
  redirect(`/discovery?batch=${batch.id}`);
}

export async function importReviewedCsv(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = value(formData, 'id');
  const batch = await prisma.importBatch.findFirst({ where: { id, workspaceId: context.workspaceId, status: 'REVIEW' } }); if (!batch) throw new Error('Import batch is no longer available.');
  const rows = Array.isArray(batch.rows) ? batch.rows as unknown as ImportReviewRow[] : [];
  const domains = rows.filter((row) => row.status === 'VALID').map((row) => row.domain);
  if (!domains.length) throw new Error('This batch has no valid domains to import.');
  const results = await importAnalyzeAndPersist(context, domains.join('\n'), batch.industry, 'CSV_FILE_IMPORT');
  await prisma.importBatch.update({ where: { id }, data: { status: 'IMPORTED', importedAt: new Date() } });
  await recordAuditEvent(context, { action: 'import.csv_completed', targetType: 'ImportBatch', targetId: id, metadata: { imported: results.length } });
  revalidatePath('/discovery'); revalidatePath('/opportunities'); revalidatePath('/overview'); redirect('/opportunities?imported=1');
}
