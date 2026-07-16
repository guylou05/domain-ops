export function normalizeOutreachEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function allowsMockOutreachDelivery(nodeEnv: string | undefined, e2eWorkflows: string | undefined): boolean {
  return nodeEnv !== 'production' || e2eWorkflows === '1';
}

export function personalizeOutreach(value: string, input: { firstName: string; company: string; domain: string }): string {
  return value.replaceAll('{{first_name}}', input.firstName).replaceAll('{{company}}', input.company).replaceAll('{{domain}}', input.domain);
}

export function deliveryBlockReason(input: {
  status: string;
  approvedAt: Date | null;
  approvedById: string | null;
  email: string | null;
  doNotContact: boolean;
  optedOutAt: Date | null;
  suppressed: boolean;
}): string | null {
  if (input.status !== 'APPROVED' || !input.approvedAt || !input.approvedById) return 'Message must receive explicit approval before delivery.';
  if (!input.email || !/^\S+@\S+\.\S+$/.test(normalizeOutreachEmail(input.email))) return 'The selected contact has no deliverable email address.';
  if (input.doNotContact || input.optedOutAt || input.suppressed) return 'Delivery blocked by contact suppression policy.';
  return null;
}
