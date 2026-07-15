'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { reviewComparableSalesCsv, type ComparableSaleReviewRow } from '@/lib/csv-mobility';
import { getComparableSalesProvider } from '@/lib/providers/comparable-sales';
import { getPublicBusinessProvider, PUBLIC_BUSINESS_POLICY_VERSION } from '@/lib/providers/public-business';
import { getAppConfig } from '@/lib/server/app-config';
import { recordAuditEvent } from '@/lib/server/audit';
import { observeOperationalCall } from '@/lib/server/observability';
import { runGovernedProviderCall } from '@/lib/server/provider-governance';
import { resolveProviderCredential } from '@/lib/server/provider-credentials';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';
import { withEntitlementUsage } from '@/lib/server/entitlements';

const read = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const normalizeDomain = (value: string) => value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
const validDomain = (value: string) => /^[a-z0-9][a-z0-9-]*(\.[a-z]{2,})+$/.test(value);

async function assertSubjectDomain(workspaceId: string, value: string): Promise<string> {
  const domain = normalizeDomain(value);
  if (!validDomain(domain) || !(await prisma.domain.findUnique({ where: { workspaceId_name: { workspaceId, name: domain } }, select: { id: true } }))) throw new Error('Subject domain was not found in this workspace.');
  return domain;
}

export async function createComparableSale(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const subjectDomain = await assertSubjectDomain(context.workspaceId, read(formData, 'subjectDomain'));
  const domain = normalizeDomain(read(formData, 'domain')); const price = Number(formData.get('price')); const saleDate = new Date(read(formData, 'saleDate'));
  const marketplace = read(formData, 'marketplace').slice(0, 120); const evidenceUrl = read(formData, 'evidenceUrl').slice(0, 500);
  if (!validDomain(domain) || !Number.isFinite(price) || price <= 0 || Number.isNaN(saleDate.getTime()) || !marketplace) throw new Error('Comparable domain, positive price, sale date, and marketplace are required.');
  if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) throw new Error('Evidence URL must use HTTPS.');
  const sale = await prisma.comparableSale.upsert({
    where: { workspaceId_subjectDomain_domain_price_saleDate: { workspaceId: context.workspaceId, subjectDomain, domain, price: new Prisma.Decimal(price), saleDate } },
    update: { marketplace, industry: read(formData, 'industry').slice(0, 120) || null, evidenceUrl: evidenceUrl || null },
    create: { workspaceId: context.workspaceId, createdById: context.userId, subjectDomain, domain, tld: domain.slice(domain.lastIndexOf('.')), price: new Prisma.Decimal(price), saleDate, marketplace, industry: read(formData, 'industry').slice(0, 120) || null, source: 'MANUAL', evidenceUrl: evidenceUrl || null },
  });
  await recordAuditEvent(context, { action: 'research.comparable_sale_saved', targetType: 'ComparableSale', targetId: sale.id, metadata: { subjectDomain } });
  revalidatePath('/research');
}

export async function removeComparableSale(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = read(formData, 'id');
  const result = await prisma.comparableSale.deleteMany({ where: { id, workspaceId: context.workspaceId } });
  if (result.count) await recordAuditEvent(context, { action: 'research.comparable_sale_removed', targetType: 'ComparableSale', targetId: id });
  revalidatePath('/research');
}

export async function reviewComparableSalesUpload(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const file = formData.get('file'); if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) throw new Error('Select a CSV file.');
  const existing = await prisma.comparableSale.findMany({ where: { workspaceId: context.workspaceId }, select: { subjectDomain: true, domain: true, price: true, saleDate: true } });
  const keys = existing.map((sale) => `${sale.subjectDomain}|${sale.domain}|${sale.price}|${sale.saleDate.toISOString()}`);
  const rows = reviewComparableSalesCsv(await file.text(), keys);
  const batch = await prisma.comparableSaleImportBatch.create({ data: { workspaceId: context.workspaceId, createdById: context.userId, filename: file.name.slice(0, 255), totalRows: rows.length, validRows: rows.filter((row) => row.status === 'VALID').length, duplicateRows: rows.filter((row) => row.status === 'DUPLICATE').length, errorRows: rows.filter((row) => row.status === 'ERROR').length, rows } });
  await recordAuditEvent(context, { action: 'research.comparable_csv_reviewed', targetType: 'ComparableSaleImportBatch', targetId: batch.id, metadata: { validRows: batch.validRows } });
  redirect(`/research?batch=${batch.id}`);
}

export async function importComparableSales(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = read(formData, 'id');
  const batch = await prisma.comparableSaleImportBatch.findFirst({ where: { id, workspaceId: context.workspaceId, status: 'REVIEW' } }); if (!batch) throw new Error('Import batch is no longer available.');
  const rows = Array.isArray(batch.rows) ? batch.rows as unknown as ComparableSaleReviewRow[] : [];
  const allowedSubjects = new Set((await prisma.domain.findMany({ where: { workspaceId: context.workspaceId }, select: { name: true } })).map((item) => item.name));
  const valid = rows.filter((row) => row.status === 'VALID' && allowedSubjects.has(row.subjectDomain));
  for (const row of valid) await prisma.comparableSale.upsert({ where: { workspaceId_subjectDomain_domain_price_saleDate: { workspaceId: context.workspaceId, subjectDomain: row.subjectDomain, domain: row.domain, price: new Prisma.Decimal(row.price), saleDate: new Date(row.saleDate) } }, update: {}, create: { workspaceId: context.workspaceId, createdById: context.userId, subjectDomain: row.subjectDomain, domain: row.domain, tld: row.domain.slice(row.domain.lastIndexOf('.')), price: new Prisma.Decimal(row.price), saleDate: new Date(row.saleDate), marketplace: row.marketplace, industry: row.industry || null, source: 'CSV', evidenceUrl: row.evidenceUrl || null } });
  await prisma.comparableSaleImportBatch.update({ where: { id }, data: { status: 'IMPORTED', importedAt: new Date() } });
  await recordAuditEvent(context, { action: 'research.comparable_csv_imported', targetType: 'ComparableSaleImportBatch', targetId: id, metadata: { imported: valid.length } });
  revalidatePath('/research'); redirect('/research?imported=1');
}

export async function syncComparableSales(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const subjectDomain = await assertSubjectDomain(context.workspaceId, read(formData, 'subjectDomain'));
  const config = await getAppConfig(); const key = await resolveProviderCredential(context.workspaceId, 'comparable_sales'); const provider = getComparableSalesProvider(config.comparableSalesProvider, config.providerEndpoints.comparableSales, key);
  const result = await withEntitlementUsage(context.workspaceId, 'due_diligence_checks', 1, () => observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.comparable_sales_sync', metadata: { mode: provider.mode } }, () => runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'comparable_sales', cacheKey: subjectDomain, policy: config.providerPolicy, execute: () => provider.search(subjectDomain), markStale: (value) => ({ ...value, stale: true }) })));
  for (const sale of result.sales) await prisma.comparableSale.upsert({ where: { workspaceId_subjectDomain_domain_price_saleDate: { workspaceId: context.workspaceId, subjectDomain, domain: sale.domain, price: new Prisma.Decimal(sale.price), saleDate: new Date(sale.saleDate) } }, update: { marketplace: sale.marketplace, industry: sale.industry, checkedAt: new Date(result.checkedAt), source: 'PROVIDER', metadata: { provider: provider.label, stale: result.stale } }, create: { workspaceId: context.workspaceId, createdById: context.userId, subjectDomain, domain: sale.domain, tld: sale.tld, price: new Prisma.Decimal(sale.price), saleDate: new Date(sale.saleDate), marketplace: sale.marketplace, industry: sale.industry, source: 'PROVIDER', checkedAt: new Date(result.checkedAt), metadata: { provider: provider.label, stale: result.stale } } });
  await recordAuditEvent(context, { action: 'research.comparable_sales_synced', targetType: 'Domain', targetId: subjectDomain, metadata: { count: result.sales.length, stale: result.stale } }); revalidatePath('/research');
}

export async function acceptPublicBusinessPolicy() {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  await prisma.researchConsent.upsert({ where: { workspaceId_provider_policyVersion: { workspaceId: context.workspaceId, provider: 'sec_edgar', policyVersion: PUBLIC_BUSINESS_POLICY_VERSION } }, update: { acceptedById: context.userId, acceptedAt: new Date(), revokedAt: null }, create: { workspaceId: context.workspaceId, provider: 'sec_edgar', acceptedById: context.userId, policyVersion: PUBLIC_BUSINESS_POLICY_VERSION } });
  await recordAuditEvent(context, { action: 'research.public_data_policy_accepted', targetType: 'ResearchConsent', targetId: 'sec_edgar' }); revalidatePath('/research');
}

export async function syncPublicBusinessEvidence(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const subjectDomain = await assertSubjectDomain(context.workspaceId, read(formData, 'subjectDomain')); const config = await getAppConfig();
  if (config.publicBusinessProvider === 'live' && !(await prisma.researchConsent.findFirst({ where: { workspaceId: context.workspaceId, provider: 'sec_edgar', policyVersion: PUBLIC_BUSINESS_POLICY_VERSION, revokedAt: null } }))) throw new Error('Accept the SEC public-data policy before running live research.');
  const provider = getPublicBusinessProvider(config.publicBusinessProvider, config.providerEndpoints.publicBusiness, config.publicBusinessContact);
  const result = await withEntitlementUsage(context.workspaceId, 'due_diligence_checks', 1, () => observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.public_business', metadata: { mode: provider.mode } }, () => runGovernedProviderCall({ workspaceId: context.workspaceId, provider: 'public_business', cacheKey: subjectDomain, policy: config.providerPolicy, execute: () => provider.search(subjectDomain), markStale: (value) => ({ ...value, stale: true }) })));
  for (const match of result.matches) await prisma.publicBusinessEvidence.upsert({ where: { workspaceId_subjectDomain_provider_companyName_sourceUrl: { workspaceId: context.workspaceId, subjectDomain, provider: provider.label, companyName: match.companyName, sourceUrl: match.sourceUrl } }, update: { jurisdiction: match.jurisdiction, identifier: match.identifier, fetchedAt: new Date(result.checkedAt), stale: result.stale }, create: { workspaceId: context.workspaceId, subjectDomain, provider: provider.label, companyName: match.companyName, jurisdiction: match.jurisdiction, identifier: match.identifier, sourceUrl: match.sourceUrl, fetchedAt: new Date(result.checkedAt), stale: result.stale, metadata: { legalNotice: result.legalNotice } } });
  await recordAuditEvent(context, { action: 'research.public_business_synced', targetType: 'Domain', targetId: subjectDomain, metadata: { count: result.matches.length, stale: result.stale } }); revalidatePath('/research');
}
