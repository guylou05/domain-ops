import { describe, expect, it } from 'vitest';
import { getRegisteredWorkerTasks, isWorkerTaskType } from '../src/worker/task-registry';

describe('worker task registry', () => {
  it('exposes supported background job task types', () => {
    expect(getRegisteredWorkerTasks().map((task) => task.type)).toEqual([
      'daily_opportunity_digest',
      'buyer_research_refresh',
      'portfolio_snapshot',
    ]);
  });

  it('rejects unsupported task types', () => {
    expect(isWorkerTaskType('portfolio_snapshot')).toBe(true);
    expect(isWorkerTaskType('unknown_task')).toBe(false);
  });
});
