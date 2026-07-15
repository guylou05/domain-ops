import { createCsv } from '@/lib/csv-mobility';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { requireWorkspaceContext } from '@/lib/server/workspace-context';

export async function GET() {
  const context = await requireWorkspaceContext();
  const records = await prisma.portfolioItem.findMany({ where: { workspaceId: context.workspaceId }, orderBy: { expirationDate: 'asc' }, include: { domain: true } });
  const csv = createCsv(['domain','status','registrar','purchase_date','purchase_cost','renewal_cost','expiration_date','valuation','buy_now','auto_renew'], records.map((item) => [item.domain.name,item.status,item.registrar,item.purchaseDate.toISOString(),item.purchaseCost,item.renewalCost,item.expirationDate.toISOString(),item.currentValuation,item.buyNowPrice,item.autoRenew]));
  await recordAuditEvent(context, { action: 'portfolio.csv_exported', targetType: 'PortfolioItem', metadata: { count: records.length } });
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="portfolio.csv"', 'Cache-Control': 'private, no-store' } });
}
