import { describe, expect, it, vi } from 'vitest';
import { sendTransactionalEmail } from '../src/lib/providers/transactional-email';

const message = {
  to: 'user@example.com',
  from: 'DomainScout AI <security@example.com>',
  subject: 'Reset your password',
  html: '<p>Reset</p>',
  text: 'Reset',
  idempotencyKey: 'password-reset-token-id',
};

describe('transactional email provider', () => {
  it('sends a Resend-compatible authenticated request', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));
    await expect(sendTransactionalEmail('https://api.resend.com/emails', 're_secret', message, fetcher)).resolves.toBe('email-1');
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_secret', 'Idempotency-Key': 'password-reset-token-id' }),
      }),
    );
  });

  it('fails closed on provider errors and malformed responses', async () => {
    const rejected = vi.fn(async () => new Response('no', { status: 401 }));
    await expect(sendTransactionalEmail('https://api.resend.com/emails', 'bad', message, rejected)).rejects.toThrow('HTTP 401');
    const malformed = vi.fn(async () => new Response('{}', { status: 200 }));
    await expect(sendTransactionalEmail('https://api.resend.com/emails', 'key', message, malformed)).rejects.toThrow('invalid response');
  });
});
