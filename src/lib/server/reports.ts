import { prisma } from '@/lib/prisma';
import { requireWorkspaceContext } from './workspace-context';

export type ReportMetric = {
  label: string;
  value: string;
};

export type ReportView = {
  id: string;
  type: string;
  title: string;
  createdAt: Date;
  summary: string;
  metrics: ReportMetric[];
  highlights: string[];
};

type ReportPayload = {
  summary?: unknown;
  metrics?: unknown;
  highlights?: unknown;
};

function toPayload(value: unknown): ReportPayload {
  return value && typeof value === 'object' ? (value as ReportPayload) : {};
}

function toMetrics(value: unknown): ReportMetric[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.label !== 'string' || typeof record.value !== 'string') return [];
    return [{ label: record.label, value: record.value }];
  });
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export async function getReports(): Promise<ReportView[]> {
  const context = await requireWorkspaceContext();

  const reports = await prisma.report.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: { createdAt: 'desc' },
  });

  return reports.map((report) => {
    const payload = toPayload(report.payload);

    return {
      id: report.id,
      type: report.type,
      title: report.title,
      createdAt: report.createdAt,
      summary: typeof payload.summary === 'string' ? payload.summary : 'No summary saved for this report.',
      metrics: toMetrics(payload.metrics),
      highlights: toStringList(payload.highlights),
    };
  });
}
