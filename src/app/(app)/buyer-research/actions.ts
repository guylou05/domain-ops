'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { generateBuyerTargetsForWorkspace } from '@/lib/server/workflow-generators';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { suppressContact } from '@/lib/server/outreach-delivery';

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export async function generateBuyerTargets(): Promise<void> {
  const context = await requireWorkspaceContext();
  assertWorkspaceWriter(context);

  try {
    await generateBuyerTargetsForWorkspace(context.workspaceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate buyer targets.';
    redirect(`/buyer-research?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/buyer-research');
  revalidatePath('/outreach');
  revalidatePath('/overview');
  redirect('/buyer-research');
}

export async function createBuyer(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const domainId = text(formData, 'domainId');
  const domain = await prisma.domain.findFirst({ where: { id: domainId, workspaceId: context.workspaceId } }); if (!domain) throw new Error('Domain was not found.');
  const buyer = await prisma.buyer.create({ data: { workspaceId: context.workspaceId, domainId, companyName: text(formData, 'companyName'), website: text(formData, 'website') || null, industry: text(formData, 'industry') || 'Unknown', location: text(formData, 'location') || null, reasonForFit: text(formData, 'reasonForFit'), relevanceScore: Math.min(100, Math.max(0, Number(formData.get('relevanceScore')) || 50)), outreachStatus: 'RESEARCHING', notes: text(formData, 'notes') || null } });
  await recordAuditEvent(context, { action: 'crm.buyer_created', targetType: 'Buyer', targetId: buyer.id }); revalidatePath('/buyer-research'); redirect(`/buyer-research/${buyer.id}`);
}

export async function updateBuyer(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = text(formData, 'id'); const status = text(formData, 'outreachStatus');
  const result = await prisma.buyer.updateMany({ where: { id, workspaceId: context.workspaceId }, data: { companyName: text(formData, 'companyName'), website: text(formData, 'website') || null, industry: text(formData, 'industry'), location: text(formData, 'location') || null, reasonForFit: text(formData, 'reasonForFit'), relevanceScore: Math.min(100, Math.max(0, Number(formData.get('relevanceScore')) || 0)), outreachStatus: ['RESEARCHING', 'READY', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CLOSED'].includes(status) ? status : 'RESEARCHING', notes: text(formData, 'notes') || null } });
  if (!result.count) throw new Error('Buyer was not found.'); await recordAuditEvent(context, { action: 'crm.buyer_updated', targetType: 'Buyer', targetId: id }); revalidatePath(`/buyer-research/${id}`); revalidatePath('/buyer-research');
}

export async function addBuyerContact(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const buyerId = text(formData, 'buyerId');
  const buyer = await prisma.buyer.findFirst({ where: { id: buyerId, workspaceId: context.workspaceId } }); if (!buyer) throw new Error('Buyer was not found.');
  const email = text(formData, 'email').toLowerCase(); if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Contact email is invalid.');
  const contact = await prisma.buyerContact.create({ data: { workspaceId: context.workspaceId, buyerId, name: text(formData, 'name') || null, title: text(formData, 'title') || null, email: email || null, phone: text(formData, 'phone') || null, linkedinUrl: text(formData, 'linkedinUrl') || null, notes: text(formData, 'notes') || null } });
  await prisma.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId, contactId: contact.id, actorId: context.userId, type: 'CONTACT_CREATED', summary: `Added ${contact.name ?? contact.email ?? 'contact'}.` } });
  await recordAuditEvent(context, { action: 'crm.contact_created', targetType: 'BuyerContact', targetId: contact.id }); revalidatePath(`/buyer-research/${buyerId}`);
}

export async function updateBuyerContact(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = text(formData, 'contactId'); const buyerId = text(formData, 'buyerId'); const email = text(formData, 'email').toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Contact email is invalid.');
  const result = await prisma.buyerContact.updateMany({ where: { id, buyerId, workspaceId: context.workspaceId }, data: { name: text(formData, 'name') || null, title: text(formData, 'title') || null, email: email || null, phone: text(formData, 'phone') || null, linkedinUrl: text(formData, 'linkedinUrl') || null, notes: text(formData, 'notes') || null, status: text(formData, 'status') === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' } });
  if (!result.count) throw new Error('Contact was not found.');
  await prisma.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId, contactId: id, actorId: context.userId, type: 'CONTACT_UPDATED', summary: `Updated contact ${email || id}.` } }); await recordAuditEvent(context, { action: 'crm.contact_updated', targetType: 'BuyerContact', targetId: id }); revalidatePath(`/buyer-research/${buyerId}`); revalidatePath('/outreach');
}

export async function logBuyerActivity(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const buyerId = text(formData, 'buyerId'); const summary = text(formData, 'summary'); if (!summary) throw new Error('Activity summary is required.');
  if (!(await prisma.buyer.findFirst({ where: { id: buyerId, workspaceId: context.workspaceId } }))) throw new Error('Buyer was not found.');
  await prisma.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId, contactId: text(formData, 'contactId') || null, actorId: context.userId, type: text(formData, 'type') || 'NOTE', summary } }); revalidatePath(`/buyer-research/${buyerId}`);
}

export async function markContactDoNotContact(formData: FormData) {
  const context = await requireWorkspaceContext(); await suppressContact(context, text(formData, 'contactId'), text(formData, 'reason') || 'Do not contact requested.', 'MANUAL'); revalidatePath(`/buyer-research/${text(formData, 'buyerId')}`); revalidatePath('/outreach');
}
