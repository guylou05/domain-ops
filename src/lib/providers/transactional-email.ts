export type TransactionalEmailMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export async function sendTransactionalEmail(
  endpoint: string,
  apiKey: string,
  message: TransactionalEmailMessage,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': message.idempotencyKey,
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Transactional email provider returned HTTP ${response.status}.`);
  const payload = (await response.json()) as { id?: unknown };
  if (typeof payload.id !== 'string' || !payload.id) throw new Error('Transactional email provider returned an invalid response.');
  return payload.id;
}
