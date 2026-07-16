import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/providers/transactional-email';
import { getAppConfig } from './app-config';
import { recordAuditEvent } from './audit';
import { observeOperationalCall } from './observability';
import { resolveProviderCredential } from './provider-credentials';
import { assertWorkspaceWriter, type WorkspaceContext } from './workspace-context';
import { allowsMockOutreachDelivery, deliveryBlockReason, normalizeOutreachEmail } from '@/lib/outreach-policy';

const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export async function deliverApprovedOutreach(context: WorkspaceContext, messageId: string) {
  assertWorkspaceWriter(context);
  const message = await prisma.outreachMessage.findFirst({ where: { id: messageId, workspaceId: context.workspaceId }, include: { contact: true, buyer: true, domain: true } });
  if (!message) throw new Error('Outreach message was not found.');
  if (message.sentAt) return { providerId: message.providerMessageId ?? 'already-sent', provider: 'existing' };
  const email = normalizeOutreachEmail(message.contact?.email ?? '');
  const suppression = await prisma.outreachSuppression.findUnique({ where: { workspaceId_email: { workspaceId: context.workspaceId, email } } });
  const blocked = deliveryBlockReason({ status: message.status, approvedAt: message.approvedAt, approvedById: message.approvedById, email, doNotContact: message.contact?.doNotContact ?? false, optedOutAt: message.contact?.optedOutAt ?? null, suppressed: suppression?.active ?? false });
  if (blocked === 'Delivery blocked by contact suppression policy.') {
    await prisma.$transaction([
      prisma.outreachMessage.update({ where: { id: message.id }, data: { status: 'SUPPRESSED', failureReason: suppression?.reason ?? 'Contact is marked do not contact.' } }),
      prisma.outreachDeliveryEvent.create({ data: { workspaceId: context.workspaceId, messageId: message.id, provider: 'policy', status: 'SUPPRESSED', detail: suppression?.reason ?? 'Do-not-contact policy' } }),
    ]);
    await recordAuditEvent(context, { action: 'outreach.delivery_blocked', targetType: 'OutreachMessage', targetId: message.id, metadata: { reason: blocked, contactId: message.contactId } });
    throw new Error(blocked);
  }
  if (blocked) throw new Error(blocked);

  const config = await getAppConfig();
  const mockDeliveryAllowed = allowsMockOutreachDelivery(process.env.NODE_ENV, process.env.E2E_WORKFLOWS);
  if (!config.transactionalEmail.enabled && !mockDeliveryAllowed) throw new Error('Live outreach delivery is not configured.');
  const key = config.transactionalEmail.enabled ? await resolveProviderCredential(context.workspaceId, 'transactional_email') : undefined;
  const provider = config.transactionalEmail.enabled ? 'resend-compatible' : 'mock-delivery';
  try {
    let providerId: string;
    if (config.transactionalEmail.enabled) {
      if (!key || !config.transactionalEmail.sender) throw new Error('Live outreach delivery is not configured.');
      providerId = await observeOperationalCall({ workspaceId: context.workspaceId, source: 'provider', event: 'provider.outreach_email', correlationId: message.id }, () => sendTransactionalEmail(config.transactionalEmail.endpoint, key, { to: email, from: config.transactionalEmail.sender, subject: message.subject, html: `<p>${escapeHtml(message.body).replaceAll('\n', '<br>')}</p>`, text: message.body, idempotencyKey: `outreach-${message.id}` }));
    } else {
      providerId = `mock-${message.id}`;
    }
    const sentAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.outreachMessage.update({ where: { id: message.id }, data: { status: 'SENT', sentAt, providerMessageId: providerId, failureReason: null } });
      await tx.outreachDeliveryEvent.create({ data: { workspaceId: context.workspaceId, messageId: message.id, provider, status: 'DELIVERED', providerId } });
      if (message.buyerId) await tx.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId: message.buyerId, contactId: message.contactId, actorId: context.userId, type: 'EMAIL_SENT', summary: `Sent outreach: ${message.subject}`, metadata: { messageId: message.id, provider } } });
    });
    await recordAuditEvent(context, { action: 'outreach.message_delivered', targetType: 'OutreachMessage', targetId: message.id, metadata: { provider, contactId: message.contactId } });
    return { providerId, provider };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Delivery failed.';
    await prisma.$transaction([
      prisma.outreachMessage.update({ where: { id: message.id }, data: { status: 'FAILED', failureReason: detail } }),
      prisma.outreachDeliveryEvent.create({ data: { workspaceId: context.workspaceId, messageId: message.id, provider, status: 'FAILED', detail } }),
    ]);
    throw error;
  }
}

export async function suppressContact(context: WorkspaceContext, contactId: string, reason: string, source = 'MANUAL') {
  assertWorkspaceWriter(context);
  const contact = await prisma.buyerContact.findFirst({ where: { id: contactId, workspaceId: context.workspaceId }, include: { buyer: true } });
  if (!contact?.email) throw new Error('Contact with email was not found.');
  const email = normalizeOutreachEmail(contact.email);
  await prisma.$transaction(async (tx) => {
    await tx.outreachSuppression.upsert({ where: { workspaceId_email: { workspaceId: context.workspaceId, email } }, update: { active: true, reason, source, createdById: context.userId, revokedAt: null }, create: { workspaceId: context.workspaceId, email, reason, source, createdById: context.userId } });
    await tx.buyerContact.update({ where: { id: contact.id }, data: { doNotContact: true, optedOutAt: source === 'OPT_OUT' ? new Date() : contact.optedOutAt } });
    await tx.outreachMessage.updateMany({ where: { workspaceId: context.workspaceId, contactId, sentAt: null, status: { in: ['DRAFT', 'APPROVED', 'SCHEDULED'] } }, data: { status: 'SUPPRESSED', failureReason: reason } });
    await tx.contactActivity.create({ data: { workspaceId: context.workspaceId, buyerId: contact.buyerId, contactId, actorId: context.userId, type: 'SUPPRESSED', summary: reason, metadata: { source } } });
  });
  await recordAuditEvent(context, { action: 'outreach.contact_suppressed', targetType: 'BuyerContact', targetId: contactId, metadata: { email, reason, source } });
}
