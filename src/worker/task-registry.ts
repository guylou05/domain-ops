export type WorkerTaskType = 'daily_opportunity_digest' | 'buyer_research_refresh' | 'portfolio_snapshot';

export type WorkerTask = {
  type: WorkerTaskType;
  description: string;
};

export const registeredTasks: WorkerTask[] = [
  { type: 'daily_opportunity_digest', description: 'Summarize active opportunities and notification state.' },
  { type: 'buyer_research_refresh', description: 'Refresh deterministic buyer research targets for queued workspaces.' },
  { type: 'portfolio_snapshot', description: 'Create portfolio snapshot reports from current workspace data.' },
];

const taskTypes = new Set(registeredTasks.map((task) => task.type));

export function getRegisteredWorkerTasks(): WorkerTask[] {
  return registeredTasks;
}

export function isWorkerTaskType(value: string): value is WorkerTaskType {
  return taskTypes.has(value as WorkerTaskType);
}
