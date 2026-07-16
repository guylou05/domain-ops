import { describe, expect, it } from 'vitest';
import { allowsMockOutreachDelivery, deliveryBlockReason, normalizeOutreachEmail, personalizeOutreach } from '../src/lib/outreach-policy';

describe('outreach delivery policy', () => {
  const approved = { status: 'APPROVED', approvedAt: new Date(), approvedById: 'admin', email: 'buyer@example.com', doNotContact: false, optedOutAt: null, suppressed: false };
  it('fails closed for mock delivery in production outside seeded workflows', () => {
    expect(allowsMockOutreachDelivery('production', undefined)).toBe(false);
    expect(allowsMockOutreachDelivery('production', '1')).toBe(true);
    expect(allowsMockOutreachDelivery('development', undefined)).toBe(true);
  });
  it('requires attributable approval', () => expect(deliveryBlockReason({ ...approved, approvedById: null })).toMatch(/explicit approval/));
  it('blocks do-not-contact, opt-out, and suppression states', () => {
    expect(deliveryBlockReason({ ...approved, doNotContact: true })).toMatch(/suppression/);
    expect(deliveryBlockReason({ ...approved, optedOutAt: new Date() })).toMatch(/suppression/);
    expect(deliveryBlockReason({ ...approved, suppressed: true })).toMatch(/suppression/);
  });
  it('allows an approved eligible recipient', () => expect(deliveryBlockReason(approved)).toBeNull());
  it('normalizes recipients and personalizes approved placeholders', () => {
    expect(normalizeOutreachEmail(' Buyer@Example.COM ')).toBe('buyer@example.com');
    expect(personalizeOutreach('Hi {{first_name}} at {{company}}: {{domain}}', { firstName: 'Dana', company: 'North', domain: 'pilot.ai' })).toBe('Hi Dana at North: pilot.ai');
  });
});
