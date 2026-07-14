import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { getAvailabilityProviderStatus, type AvailabilityProviderMode } from '../providers/availability';

export type AppConfig = {
  availabilityProvider: AvailabilityProviderMode;
  authDiagnosticsEnabled: boolean;
  workerJobLimit: number;
  workerLeaseMs: number;
};

const CONFIG_KEY = 'runtime';
const DEFAULT_CONFIG: AppConfig = {
  availabilityProvider: 'mock',
  authDiagnosticsEnabled: false,
  workerJobLimit: 5,
  workerLeaseMs: 300000,
};

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readProvider(value: unknown): AvailabilityProviderMode {
  if (value === 'deterministic' || value === 'mock' || value === 'live') return value;
  return DEFAULT_CONFIG.availabilityProvider;
}

function readPositiveInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.max(Math.floor(numeric), minimum), maximum);
}

export function parseAppConfig(value: unknown): AppConfig {
  const object = readObject(value);
  return {
    availabilityProvider: readProvider(object.availabilityProvider),
    authDiagnosticsEnabled: object.authDiagnosticsEnabled === true,
    workerJobLimit: readPositiveInteger(object.workerJobLimit, DEFAULT_CONFIG.workerJobLimit, 1, 50),
    workerLeaseMs: readPositiveInteger(object.workerLeaseMs, DEFAULT_CONFIG.workerLeaseMs, 10000, 3600000),
  };
}

export async function getAppConfig(): Promise<AppConfig> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: CONFIG_KEY },
    select: { value: true },
  });
  return parseAppConfig(setting?.value);
}

export async function upsertAppConfig(config: AppConfig): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: CONFIG_KEY },
    update: { value: config as unknown as Prisma.InputJsonValue },
    create: { key: CONFIG_KEY, value: config as unknown as Prisma.InputJsonValue },
  });
}

export async function updateAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await getAppConfig();
  const next = parseAppConfig({ ...current, ...patch });
  await upsertAppConfig(next);
  return next;
}

export async function getAvailabilityStatusFromConfig() {
  const config = await getAppConfig();
  return getAvailabilityProviderStatus(config.availabilityProvider);
}

export async function isAuthDiagnosticsEnabled(): Promise<boolean> {
  const config = await getAppConfig();
  return config.authDiagnosticsEnabled;
}
