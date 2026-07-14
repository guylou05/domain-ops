type WorkerTask = {
  type: string;
  description: string;
};

const registeredTasks: WorkerTask[] = [
  { type: 'daily_opportunity_digest', description: 'Summarize active opportunities and notification state.' },
  { type: 'buyer_research_refresh', description: 'Refresh deterministic buyer research targets for queued workspaces.' },
  { type: 'portfolio_snapshot', description: 'Create portfolio snapshot reports from current workspace data.' },
];

export function getRegisteredWorkerTasks(): WorkerTask[] {
  return registeredTasks;
}

if (require.main === module) {
  console.log(`DomainScout AI worker ready. Registered tasks: ${registeredTasks.map((task) => task.type).join(', ')}`);
}
