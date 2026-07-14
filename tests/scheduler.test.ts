import { describe, expect, it } from 'vitest';
import { isScheduleDue } from '../src/scheduler/cadence';
import { withRedisLock } from '../src/scheduler/redis-lock';

describe('recurring scheduler cadence', () => {
  const now = new Date('2026-07-14T12:00:00.000Z');

  it('schedules tasks that have never run', () => {
    expect(isScheduleDue(null, 60, now)).toBe(true);
  });

  it('waits until the configured interval has elapsed', () => {
    expect(isScheduleDue(new Date('2026-07-14T11:30:01.000Z'), 30, now)).toBe(false);
    expect(isScheduleDue(new Date('2026-07-14T11:30:00.000Z'), 30, now)).toBe(true);
  });
});

describe('scheduler Redis lock', () => {
  it('runs and releases work after acquiring the lock', async () => {
    const releases: Array<{ keys: string[]; arguments: string[] }> = [];
    const client = {
      set: async () => 'OK',
      eval: async (_script: string, options: { keys: string[]; arguments: string[] }) => {
        releases.push(options);
        return 1;
      },
    };

    const result = await withRedisLock(client, 'scheduler-lock', 30000, async () => 'queued');

    expect(result).toEqual({ acquired: true, value: 'queued' });
    expect(releases).toHaveLength(1);
    expect(releases[0].keys).toEqual(['scheduler-lock']);
    expect(releases[0].arguments[0]).toBeTruthy();
  });

  it('skips work when another replica holds the lock', async () => {
    let ran = false;
    const client = {
      set: async () => null,
      eval: async () => 0,
    };

    const result = await withRedisLock(client, 'scheduler-lock', 30000, async () => {
      ran = true;
    });

    expect(result).toEqual({ acquired: false });
    expect(ran).toBe(false);
  });
});
