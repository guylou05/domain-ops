export function isScheduleDue(lastCreatedAt: Date | null, intervalMinutes: number, now: Date): boolean {
  if (!lastCreatedAt) return true;
  return now.getTime() - lastCreatedAt.getTime() >= intervalMinutes * 60_000;
}
