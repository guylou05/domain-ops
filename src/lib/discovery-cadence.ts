const intervalDays = (schedule: string) => schedule === 'DAILY' ? 1 : schedule === 'WEEKLY' ? 7 : 0;

export function nextDiscoveryRun(schedule: string, from = new Date()): Date | null {
  const days = intervalDays(schedule);
  return days ? new Date(from.getTime() + days * 86400000) : null;
}
