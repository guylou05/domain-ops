import { randomUUID } from 'node:crypto';

type RedisLockClient = {
  set(key: string, value: string, options: { NX: true; PX: number }): Promise<string | null>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
};

const RELEASE_LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

export async function withRedisLock<T>(
  client: RedisLockClient,
  key: string,
  ttlMs: number,
  callback: () => Promise<T>,
): Promise<{ acquired: boolean; value?: T }> {
  const token = randomUUID();
  const acquired = await client.set(key, token, { NX: true, PX: ttlMs });
  if (acquired !== 'OK') return { acquired: false };

  try {
    return { acquired: true, value: await callback() };
  } finally {
    await client.eval(RELEASE_LOCK_SCRIPT, { keys: [key], arguments: [token] });
  }
}
