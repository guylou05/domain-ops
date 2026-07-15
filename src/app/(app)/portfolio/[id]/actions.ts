'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { renewalRecommendation, saleEconomics } from '@/lib/deal-lifecycle';
import { recordAuditEvent } from '@/lib/server/audit';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const money = (data: FormData, key: string) => {
  const value = Number(data.get(key));
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a positive amount.`);
  return new Prisma.Decimal(value);
};

async function holdingForWrite(id: string, workspaceId: string) {
  const holding = await prisma.portfolioItem.findFirst({ where: { id, workspaceId } });
  if (!holding) throw new Error('Portfolio holding was not found.');
  return holding;
}

export async function updateHolding(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const id = text(formData, 'id'); await holdingForWrite(id, context.workspaceId);
  const expirationDate = new Date(text(formData, 'expirationDate'));
  if (Number.isNaN(expirationDate.getTime())) throw new Error('Expiration date is invalid.');
  await prisma.portfolioItem.update({ where: { id }, data: {
    registrar: text(formData, 'registrar'), purchaseSource: text(formData, 'purchaseSource') || null,
    purchaseCost: money(formData, 'purchaseCost'), renewalCost: money(formData, 'renewalCost'),
    currentValuation: money(formData, 'currentValuation'), buyNowPrice: money(formData, 'buyNowPrice'), minSalePrice: money(formData, 'minSalePrice'),
    expirationDate, autoRenew: formData.get('autoRenew') === 'on',
    category: text(formData, 'category') || null, tags: text(formData, 'tags').split(',').map((item) => item.trim()).filter(Boolean),
    nameservers: text(formData, 'nameservers').split(',').map((item) => item.trim()).filter(Boolean), notes: text(formData, 'notes') || null,
  }});
  await recordAuditEvent(context, { action: 'portfolio.holding_updated', targetType: 'PortfolioItem', targetId: id });
  revalidatePath(`/portfolio/${id}`); revalidatePath('/portfolio'); revalidatePath('/renewals'); revalidatePath('/overview');
}

export async function createOffer(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const id = text(formData, 'id'); const holding = await holdingForWrite(id, context.workspaceId);
  const amount = money(formData, 'amount');
  if (amount.lte(0)) throw new Error('Offer amount must be greater than zero.');
  const offer = await prisma.offer.create({ data: { workspaceId: context.workspaceId, domainId: holding.domainId, amount, status: 'RECEIVED', buyerName: text(formData, 'buyerName') || null, buyerEmail: text(formData, 'buyerEmail') || null, notes: text(formData, 'notes') || null } });
  await recordAuditEvent(context, { action: 'deal.offer_created', targetType: 'PortfolioItem', targetId: id, metadata: { offerId: offer.id } });
  revalidatePath(`/portfolio/${id}`); revalidatePath('/overview');
}

export async function updateOfferStatus(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const id = text(formData, 'id'); await holdingForWrite(id, context.workspaceId);
  const offerId = text(formData, 'offerId'); const status = text(formData, 'status');
  if (!['RECEIVED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'].includes(status)) throw new Error('Offer status is invalid.');
  const result = await prisma.offer.updateMany({ where: { id: offerId, workspaceId: context.workspaceId }, data: { status, respondedAt: new Date() } });
  if (!result.count) throw new Error('Offer was not found.');
  await recordAuditEvent(context, { action: 'deal.offer_status_updated', targetType: 'PortfolioItem', targetId: id, metadata: { offerId, status } });
  revalidatePath(`/portfolio/${id}`); revalidatePath('/overview');
}

export async function recordSale(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const id = text(formData, 'id'); const holding = await holdingForWrite(id, context.workspaceId);
  const salePrice = Number(formData.get('salePrice')); const fees = Number(formData.get('fees'));
  if (!Number.isFinite(salePrice) || salePrice <= 0 || !Number.isFinite(fees) || fees < 0 || fees > salePrice) throw new Error('Sale price and fees are invalid.');
  const saleDate = new Date(text(formData, 'saleDate'));
  if (Number.isNaN(saleDate.getTime())) throw new Error('Sale date is invalid.');
  const economics = saleEconomics(salePrice, fees, holding.purchaseCost.toNumber());
  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({ data: { workspaceId: context.workspaceId, domainId: holding.domainId, salePrice, fees, netProfit: economics.netProfit, saleDate, source: text(formData, 'source') || null, notes: text(formData, 'notes') || null } });
    await tx.portfolioItem.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return created;
  });
  await recordAuditEvent(context, { action: 'deal.sale_recorded', targetType: 'PortfolioItem', targetId: id, metadata: { saleId: sale.id, netProfit: economics.netProfit } });
  revalidatePath(`/portfolio/${id}`); revalidatePath('/portfolio'); revalidatePath('/renewals'); revalidatePath('/overview');
}

export async function recordRenewalDecision(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context);
  const id = text(formData, 'id'); const holding = await holdingForWrite(id, context.workspaceId); const decision = text(formData, 'decision');
  if (!['KEEP', 'REVIEW', 'DROP'].includes(decision)) throw new Error('Renewal decision is invalid.');
  const domain = await prisma.domain.findFirstOrThrow({ where: { id: holding.domainId, workspaceId: context.workspaceId }, include: { opportunity: true, offers: { where: { status: { in: ['RECEIVED', 'COUNTERED'] } } } } });
  const recommendation = renewalRecommendation({ score: domain.opportunity?.score ?? null, valuation: holding.currentValuation.toNumber(), renewalCost: holding.renewalCost.toNumber(), openOffers: domain.offers.length, riskLevel: domain.opportunity?.riskLevel ?? null });
  await prisma.renewal.upsert({ where: { workspaceId_domainId_dueDate: { workspaceId: context.workspaceId, domainId: holding.domainId, dueDate: holding.expirationDate } }, update: { decision, recommendation, status: 'DECIDED', notes: text(formData, 'notes') || null, decidedAt: new Date() }, create: { workspaceId: context.workspaceId, domainId: holding.domainId, dueDate: holding.expirationDate, cost: holding.renewalCost, recommendation, status: 'DECIDED', decision, notes: text(formData, 'notes') || null, decidedAt: new Date() } });
  if (decision === 'DROP') await prisma.portfolioItem.update({ where: { id }, data: { autoRenew: false } });
  await recordAuditEvent(context, { action: 'renewal.decision_recorded', targetType: 'PortfolioItem', targetId: id, metadata: { decision } });
  revalidatePath(`/portfolio/${id}`); revalidatePath('/renewals'); revalidatePath('/overview');
}
