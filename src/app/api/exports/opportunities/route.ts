import { createCsv } from '@/lib/csv-mobility';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function GET() {
  const context = await requireWorkspaceContext();
  const records = await prisma.domainOpportunity.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { score: 'desc' }, include: { domain: true } });
  const csv = createCsv(['domain','source','score','risk','retail_min','retail_max','buyers','approval'], records.map((item) => [item.domain.name,item.domain.source,item.score,item.riskLevel,item.estimatedRetailMin,item.estimatedRetailMax,item.buyerCount,item.approvalStatus]));
  await recordAuditEvent(context, { action: 'opportunity.csv_exported', targetType: 'DomainOpportunity', metadata: { count: records.length } });
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="opportunities.csv"', 'Cache-Control': 'private, no-store' } });
}
