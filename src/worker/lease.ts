const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const MINIMUM_LEASE_MS = 10 * 1000;
type WorkerLeaseEnv = Record<string, string | undefined>;

export function readWorkerId(env: WorkerLeaseEnv = process.env): string {
  const configured = env.WORKER_ID?.trim();
  return configured && configured.length > 0 ? configured : `worker-${process.pid}`;
}

export function readLeaseMs(env: WorkerLeaseEnv = process.env): number {
  const configured = Number(env.WORKER_LEASE_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_LEASE_MS;
  }
  return Math.max(configured, MINIMUM_LEASE_MS);
}

export function nextLeaseExpiry(now = new Date(), leaseMs = readLeaseMs()): Date {
  return new Date(now.getTime() + leaseMs);
}
