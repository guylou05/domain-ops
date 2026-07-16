'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAuditEvent } from '@/lib/server/audit';
import { deliverApprovedOutreach, suppressContact } from '@/lib/server/outreach-delivery';
import { assertWorkspaceWriter, requireWorkspaceContext } from '@/lib/server/workspace-context';
import { personalizeOutreach } from '@/lib/outreach-policy';

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const refresh = () => { revalidatePath('/outreach'); revalidatePath('/buyer-research'); revalidatePath('/overview'); };

export async function createOutreachCampaign(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const name = text(formData, 'name'); if (name.length < 2) throw new Error('Campaign name is required.');
  const campaign = await prisma.outreachCampaign.create({ data: { workspaceId: context.workspaceId, createdById: context.userId, name, description: text(formData, 'description') || null, scheduledAt: text(formData, 'scheduledAt') ? new Date(text(formData, 'scheduledAt')) : null } });
  await recordAuditEvent(context, { action: 'outreach.campaign_created', targetType: 'OutreachCampaign', targetId: campaign.id }); refresh();
}

export async function createOutreachTemplate(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const name = text(formData, 'name'); const subject = text(formData, 'subject'); const body = text(formData, 'body'); if (!name || !subject || !body) throw new Error('Template name, subject, and body are required.');
  const template = await prisma.outreachTemplate.upsert({ where: { workspaceId_name: { workspaceId: context.workspaceId, name } }, update: { subject, body, status: 'ACTIVE' }, create: { workspaceId: context.workspaceId, createdById: context.userId, name, subject, body } });
  await recordAuditEvent(context, { action: 'outreach.template_saved', targetType: 'OutreachTemplate', targetId: template.id }); refresh();
}

export async function createOutreachDraft(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const campaignId = text(formData, 'campaignId'); const contactId = text(formData, 'contactId'); const templateId = text(formData, 'templateId');
  const [campaign, contact, template] = await Promise.all([
    prisma.outreachCampaign.findFirst({ where: { id: campaignId, workspaceId: context.workspaceId } }),
    prisma.buyerContact.findFirst({ where: { id: contactId, workspaceId: context.workspaceId }, include: { buyer: { include: { domain: true } } } }),
    templateId ? prisma.outreachTemplate.findFirst({ where: { id: templateId, workspaceId: context.workspaceId, status: 'ACTIVE' } }) : null,
  ]);
  if (!campaign || !contact) throw new Error('Campaign or contact was not found.');
  if (!contact.email || contact.doNotContact || contact.optedOutAt) throw new Error('Contact is not eligible for outreach.');
  const input = { firstName: contact.name?.split(' ')[0] ?? 'there', company: contact.buyer.companyName, domain: contact.buyer.domain.name };
  const subjectSource = text(formData, 'subject') || template?.subject || ''; const bodySource = text(formData, 'body') || template?.body || ''; if (!subjectSource || !bodySource) throw new Error('Draft subject and body are required.');
  const message = await prisma.outreachMessage.create({ data: { workspaceId: context.workspaceId, campaignId, buyerId: contact.buyerId, contactId: contact.id, domainId: contact.buyer.domainId, templateId: template?.id, subject: personalizeOutreach(subjectSource, input), body: personalizeOutreach(bodySource, input), status: 'DRAFT', scheduledAt: text(formData, 'scheduledAt') ? new Date(text(formData, 'scheduledAt')) : null } });
  await prisma.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId: contact.buyerId, contactId: contact.id, actorId: context.userId, type: 'DRAFT_CREATED', summary: `Created outreach draft: ${message.subject}`, metadata: { messageId: message.id } } });
  await recordAuditEvent(context, { action: 'outreach.draft_created', targetType: 'OutreachMessage', targetId: message.id }); refresh();
}

export async function approveOutreachMessage(formData: FormData): Promise<void> {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const messageId = text(formData, 'messageId');
  const result = await prisma.outreachMessage.updateMany({ where: { id: messageId, workspaceId: context.workspaceId, approvedAt: null, status: 'DRAFT' }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: context.userId } });
  if (!result.count) throw new Error('Only draft messages can be approved.'); await recordAuditEvent(context, { action: 'outreach.message_approved', targetType: 'OutreachMessage', targetId: messageId }); refresh();
}

export async function bulkApproveOutreach(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const ids = formData.getAll('messageId').map(String).slice(0, 100); if (!ids.length) throw new Error('Select at least one draft.');
  const result = await prisma.outreachMessage.updateMany({ where: { id: { in: ids }, workspaceId: context.workspaceId, status: 'DRAFT', approvedAt: null }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: context.userId } });
  await recordAuditEvent(context, { action: 'outreach.messages_bulk_approved', targetType: 'OutreachMessage', metadata: { count: result.count } }); refresh();
}

export async function deliverOutreachMessage(formData: FormData) {
  const context = await requireWorkspaceContext(); await deliverApprovedOutreach(context, text(formData, 'messageId')); refresh();
}

export async function createFollowUp(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = text(formData, 'messageId');
  const source = await prisma.outreachMessage.findFirst({ where: { id, workspaceId: context.workspaceId } }); if (!source?.campaignId || !source.contactId) throw new Error('Source message cannot create a follow-up.');
  const message = await prisma.outreachMessage.create({ data: { workspaceId: context.workspaceId, campaignId: source.campaignId, buyerId: source.buyerId, contactId: source.contactId, domainId: source.domainId, templateId: source.templateId, sequenceStep: source.sequenceStep + 1, subject: text(formData, 'subject') || `Re: ${source.subject}`, body: text(formData, 'body'), status: 'DRAFT', scheduledAt: new Date(text(formData, 'scheduledAt')) } });
  await recordAuditEvent(context, { action: 'outreach.follow_up_created', targetType: 'OutreachMessage', targetId: message.id, metadata: { sourceMessageId: id } }); refresh();
}

export async function createOutreachTask(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const campaignId = text(formData, 'campaignId') || null; if (campaignId && !(await prisma.outreachCampaign.findFirst({ where: { id: campaignId, workspaceId: context.workspaceId } }))) throw new Error('Campaign was not found.');
  const task = await prisma.outreachTask.create({ data: { workspaceId: context.workspaceId, campaignId, assignedToId: context.userId, title: text(formData, 'title'), notes: text(formData, 'notes') || null, dueAt: text(formData, 'dueAt') ? new Date(text(formData, 'dueAt')) : null } }); await recordAuditEvent(context, { action: 'outreach.task_created', targetType: 'OutreachTask', targetId: task.id }); refresh();
}

export async function completeOutreachTask(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = text(formData, 'id'); const result = await prisma.outreachTask.updateMany({ where: { id, workspaceId: context.workspaceId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt: new Date() } }); if (!result.count) throw new Error('Task was not found.'); await recordAuditEvent(context, { action: 'outreach.task_completed', targetType: 'OutreachTask', targetId: id }); refresh();
}

export async function recordOutreachResponse(formData: FormData) {
  const context = await requireWorkspaceContext(); assertWorkspaceWriter(context); const id = text(formData, 'messageId'); const status = text(formData, 'responseStatus');
  const message = await prisma.outreachMessage.findFirst({ where: { id, workspaceId: context.workspaceId, sentAt: { not: null } }, include: { contact: true, buyer: true } }); if (!message?.buyerId) throw new Error('Sent message was not found.');
  let offerId: string | null = null; const amount = Number(formData.get('offerAmount'));
  if (Number.isFinite(amount) && amount > 0 && message.domainId) { const offer = await prisma.offer.create({ data: { workspaceId: context.workspaceId, domainId: message.domainId, amount: new Prisma.Decimal(amount), status: 'RECEIVED', buyerName: message.contact?.name ?? message.buyer?.companyName, buyerEmail: message.contact?.email, notes: `Created from outreach response ${message.id}.` } }); offerId = offer.id; }
  await prisma.$transaction([prisma.outreachMessage.update({ where: { id }, data: { responseStatus: status || 'RESPONDED', responseBody: text(formData, 'responseBody') || null, respondedAt: new Date(), offerId, status: 'RESPONDED' } }), prisma.buyer.update({ where: { id: message.buyerId }, data: { outreachStatus: offerId ? 'QUALIFIED' : 'RESPONDED' } }), prisma.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId: message.buyerId, contactId: message.contactId, actorId: context.userId, type: 'RESPONSE', summary: text(formData, 'responseBody') || status, metadata: { messageId: id, offerId } } })]);
  if (status === 'OPT_OUT' && message.contactId) await suppressContact(context, message.contactId, 'Recipient opted out in response.', 'OPT_OUT');
  await recordAuditEvent(context, { action: 'outreach.response_recorded', targetType: 'OutreachMessage', targetId: id, metadata: { status, offerId } }); refresh();
}

export async function suppressOutreachContact(formData: FormData) {
  const context = await requireWorkspaceContext(); await suppressContact(context, text(formData, 'contactId'), text(formData, 'reason') || 'Opt-out recorded.', text(formData, 'source') || 'OPT_OUT'); refresh();
}
