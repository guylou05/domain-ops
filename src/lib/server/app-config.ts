import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { AvailabilityProviderMode } from '../providers/availability';

export type AppConfig = {
  availabilityProvider: AvailabilityProviderMode;
  trademarkProvider: AvailabilityProviderMode;
  comparableSalesProvider: AvailabilityProviderMode;
  historyProvider: AvailabilityProviderMode;
  providerEndpoints: {
    registrar: string;
    trademark: string;
    comparableSales: string;
    history: string;
  };
  authDiagnosticsEnabled: boolean;
  transactionalEmail: {
    enabled: boolean;
    sender: string;
    endpoint: string;
  };
  billing: {
    mode: 'off' | 'test' | 'live';
    currency: string;
  };
  workerJobLimit: number;
  workerLeaseMs: number;
  schedulerEnabled: boolean;
  schedulerPollMs: number;
  jobSchedules: {
    dailyOpportunityDigest: JobScheduleConfig;
    buyerResearchRefresh: JobScheduleConfig;
    portfolioSnapshot: JobScheduleConfig;
  };
};

export type JobScheduleConfig = {
  enabled: boolean;
  intervalMinutes: number;
};

const CONFIG_KEY = 'runtime';
const DEFAULT_CONFIG: AppConfig = {
  availabilityProvider: 'mock',
  trademarkProvider: 'mock',
  comparableSalesProvider: 'mock',
  historyProvider: 'mock',
  providerEndpoints: { registrar: '', trademark: '', comparableSales: '', history: '' },
  authDiagnosticsEnabled: false,
  transactionalEmail: {
    enabled: false,
    sender: '',
    endpoint: 'https://api.resend.com/emails',
  },
  billing: {
    mode: 'off',
    currency: 'usd',
  },
  workerJobLimit: 5,
  workerLeaseMs: 300000,
  schedulerEnabled: false,
  schedulerPollMs: 60000,
  jobSchedules: {
    dailyOpportunityDigest: { enabled: true, intervalMinutes: 1440 },
    buyerResearchRefresh: { enabled: true, intervalMinutes: 360 },
    portfolioSnapshot: { enabled: true, intervalMinutes: 1440 },
  },
};

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readProvider(value: unknown): AvailabilityProviderMode {
  if (value === 'deterministic' || value === 'mock' || value === 'live') return value;
  return DEFAULT_CONFIG.availabilityProvider;
}

function readEndpoint(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function readEmailSender(value: unknown): string {
  if (typeof value !== 'string') return '';
  const sender = value.trim();
  return /\S+@\S+\.\S+/.test(sender) ? sender.slice(0, 320) : '';
}

function readBillingMode(value: unknown): AppConfig['billing']['mode'] {
  return value === 'test' || value === 'live' ? value : 'off';
}

function readCurrency(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CONFIG.billing.currency;
  const currency = value.trim().toLowerCase();
  return /^[a-z]{3}$/.test(currency) ? currency : DEFAULT_CONFIG.billing.currency;
}

function readPositiveInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.max(Math.floor(numeric), minimum), maximum);
}

function readJobSchedule(value: unknown, fallback: JobScheduleConfig): JobScheduleConfig {
  const object = readObject(value);
  return {
    enabled: typeof object.enabled === 'boolean' ? object.enabled : fallback.enabled,
    intervalMinutes: readPositiveInteger(object.intervalMinutes, fallback.intervalMinutes, 5, 10080),
  };
}

export function parseAppConfig(value: unknown): AppConfig {
  const object = readObject(value);
  const schedules = readObject(object.jobSchedules);
  const endpoints = readObject(object.providerEndpoints);
  const transactionalEmail = readObject(object.transactionalEmail);
  const billing = readObject(object.billing);
  return {
    availabilityProvider: readProvider(object.availabilityProvider),
    trademarkProvider: readProvider(object.trademarkProvider),
    comparableSalesProvider: readProvider(object.comparableSalesProvider),
    historyProvider: readProvider(object.historyProvider),
    providerEndpoints: {
      registrar: readEndpoint(endpoints.registrar),
      trademark: readEndpoint(endpoints.trademark),
      comparableSales: readEndpoint(endpoints.comparableSales),
      history: readEndpoint(endpoints.history),
    },
    authDiagnosticsEnabled: object.authDiagnosticsEnabled === true,
    transactionalEmail: {
      enabled: transactionalEmail.enabled === true,
      sender: readEmailSender(transactionalEmail.sender),
      endpoint: readEndpoint(transactionalEmail.endpoint) || DEFAULT_CONFIG.transactionalEmail.endpoint,
    },
    billing: {
      mode: readBillingMode(billing.mode),
      currency: readCurrency(billing.currency),
    },
    workerJobLimit: readPositiveInteger(object.workerJobLimit, DEFAULT_CONFIG.workerJobLimit, 1, 50),
    workerLeaseMs: readPositiveInteger(object.workerLeaseMs, DEFAULT_CONFIG.workerLeaseMs, 10000, 3600000),
    schedulerEnabled: object.schedulerEnabled === true,
    schedulerPollMs: readPositiveInteger(object.schedulerPollMs, DEFAULT_CONFIG.schedulerPollMs, 10000, 600000),
    jobSchedules: {
      dailyOpportunityDigest: readJobSchedule(schedules.dailyOpportunityDigest, DEFAULT_CONFIG.jobSchedules.dailyOpportunityDigest),
      buyerResearchRefresh: readJobSchedule(schedules.buyerResearchRefresh, DEFAULT_CONFIG.jobSchedules.buyerResearchRefresh),
      portfolioSnapshot: readJobSchedule(schedules.portfolioSnapshot, DEFAULT_CONFIG.jobSchedules.portfolioSnapshot),
    },
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

export async function isAuthDiagnosticsEnabled(): Promise<boolean> {
  const config = await getAppConfig();
  return config.authDiagnosticsEnabled;
}
