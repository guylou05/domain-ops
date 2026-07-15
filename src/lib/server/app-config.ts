import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import type { AvailabilityProviderMode } from '../providers/availability';

export type AppConfig = {
  availabilityProvider: AvailabilityProviderMode;
  registrarAdapter: 'generic' | 'namecom';
  trademarkProvider: AvailabilityProviderMode;
  comparableSalesProvider: AvailabilityProviderMode;
  historyProvider: AvailabilityProviderMode;
  publicBusinessProvider: AvailabilityProviderMode;
  providerEndpoints: {
    registrar: string;
    trademark: string;
    comparableSales: string;
    history: string;
    publicBusiness: string;
  };
  publicBusinessContact: string;
  providerPolicy: {
    cacheTtlMinutes: number;
    staleTtlHours: number;
    dailyQuota: number;
    minimumIntervalMs: number;
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
  observability: {
    retentionDays: number;
    alertMinimumLevel: 'WARN' | 'ERROR';
    emailAlertsEnabled: boolean;
    emailRecipients: string[];
    alertCooldownMinutes: number;
  };
  abuseProtection: {
    enabled: boolean;
    loginIpLimit: number;
    loginAccountLimit: number;
    loginWindowMinutes: number;
    registrationIpLimit: number;
    registrationWindowMinutes: number;
    recoveryIpLimit: number;
    recoveryAccountLimit: number;
    recoveryWindowMinutes: number;
    verificationAccountLimit: number;
    verificationWindowMinutes: number;
  };
  workerJobLimit: number;
  workerLeaseMs: number;
  schedulerEnabled: boolean;
  schedulerPollMs: number;
  renewalReminderDays: number[];
  jobSchedules: {
    dailyOpportunityDigest: JobScheduleConfig;
    buyerResearchRefresh: JobScheduleConfig;
    portfolioSnapshot: JobScheduleConfig;
    renewalReminders: JobScheduleConfig;
    savedSearchDiscovery: JobScheduleConfig;
  };
};

export type JobScheduleConfig = {
  enabled: boolean;
  intervalMinutes: number;
};

const CONFIG_KEY = 'runtime';
const DEFAULT_CONFIG: AppConfig = {
  availabilityProvider: 'mock',
  registrarAdapter: 'generic',
  trademarkProvider: 'mock',
  comparableSalesProvider: 'mock',
  historyProvider: 'mock',
  publicBusinessProvider: 'mock',
  providerEndpoints: { registrar: '', trademark: '', comparableSales: '', history: '', publicBusiness: '' },
  publicBusinessContact: '',
  providerPolicy: { cacheTtlMinutes: 30, staleTtlHours: 24, dailyQuota: 500, minimumIntervalMs: 250 },
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
  observability: {
    retentionDays: 30,
    alertMinimumLevel: 'ERROR',
    emailAlertsEnabled: false,
    emailRecipients: [],
    alertCooldownMinutes: 60,
  },
  abuseProtection: {
    enabled: true,
    loginIpLimit: 60,
    loginAccountLimit: 8,
    loginWindowMinutes: 15,
    registrationIpLimit: 10,
    registrationWindowMinutes: 60,
    recoveryIpLimit: 10,
    recoveryAccountLimit: 3,
    recoveryWindowMinutes: 60,
    verificationAccountLimit: 3,
    verificationWindowMinutes: 60,
  },
  workerJobLimit: 5,
  workerLeaseMs: 300000,
  schedulerEnabled: false,
  schedulerPollMs: 60000,
  renewalReminderDays: [90, 60, 30, 14, 7, 1],
  jobSchedules: {
    dailyOpportunityDigest: { enabled: true, intervalMinutes: 1440 },
    buyerResearchRefresh: { enabled: true, intervalMinutes: 360 },
    portfolioSnapshot: { enabled: true, intervalMinutes: 1440 },
    renewalReminders: { enabled: true, intervalMinutes: 1440 },
    savedSearchDiscovery: { enabled: true, intervalMinutes: 60 },
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

function readEmailRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase()).filter((item) => /^\S+@\S+\.\S+$/.test(item)))].slice(0, 5);
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

function readReminderDays(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_CONFIG.renewalReminderDays;
  const days = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 365))].sort((a, b) => b - a);
  return days.length ? days.slice(0, 12) : DEFAULT_CONFIG.renewalReminderDays;
}

export function parseAppConfig(value: unknown): AppConfig {
  const object = readObject(value);
  const schedules = readObject(object.jobSchedules);
  const endpoints = readObject(object.providerEndpoints);
  const providerPolicy = readObject(object.providerPolicy);
  const transactionalEmail = readObject(object.transactionalEmail);
  const billing = readObject(object.billing);
  const observability = readObject(object.observability);
  const abuseProtection = readObject(object.abuseProtection);
  return {
    availabilityProvider: readProvider(object.availabilityProvider),
    registrarAdapter: object.registrarAdapter === 'namecom' ? 'namecom' : 'generic',
    trademarkProvider: readProvider(object.trademarkProvider),
    comparableSalesProvider: readProvider(object.comparableSalesProvider),
    historyProvider: readProvider(object.historyProvider),
    publicBusinessProvider: readProvider(object.publicBusinessProvider),
    providerEndpoints: {
      registrar: readEndpoint(endpoints.registrar),
      trademark: readEndpoint(endpoints.trademark),
      comparableSales: readEndpoint(endpoints.comparableSales),
      history: readEndpoint(endpoints.history),
      publicBusiness: readEndpoint(endpoints.publicBusiness),
    },
    publicBusinessContact: readEmailSender(object.publicBusinessContact),
    providerPolicy: {
      cacheTtlMinutes: readPositiveInteger(providerPolicy.cacheTtlMinutes, DEFAULT_CONFIG.providerPolicy.cacheTtlMinutes, 1, 1440),
      staleTtlHours: readPositiveInteger(providerPolicy.staleTtlHours, DEFAULT_CONFIG.providerPolicy.staleTtlHours, 1, 720),
      dailyQuota: readPositiveInteger(providerPolicy.dailyQuota, DEFAULT_CONFIG.providerPolicy.dailyQuota, 1, 100000),
      minimumIntervalMs: readPositiveInteger(providerPolicy.minimumIntervalMs, DEFAULT_CONFIG.providerPolicy.minimumIntervalMs, 0, 60000),
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
    observability: {
      retentionDays: readPositiveInteger(observability.retentionDays, DEFAULT_CONFIG.observability.retentionDays, 7, 365),
      alertMinimumLevel: observability.alertMinimumLevel === 'WARN' ? 'WARN' : 'ERROR',
      emailAlertsEnabled: observability.emailAlertsEnabled === true,
      emailRecipients: readEmailRecipients(observability.emailRecipients),
      alertCooldownMinutes: readPositiveInteger(observability.alertCooldownMinutes, DEFAULT_CONFIG.observability.alertCooldownMinutes, 5, 1440),
    },
    abuseProtection: {
      enabled: abuseProtection.enabled !== false,
      loginIpLimit: readPositiveInteger(abuseProtection.loginIpLimit, DEFAULT_CONFIG.abuseProtection.loginIpLimit, 5, 1000),
      loginAccountLimit: readPositiveInteger(abuseProtection.loginAccountLimit, DEFAULT_CONFIG.abuseProtection.loginAccountLimit, 3, 100),
      loginWindowMinutes: readPositiveInteger(abuseProtection.loginWindowMinutes, DEFAULT_CONFIG.abuseProtection.loginWindowMinutes, 1, 1440),
      registrationIpLimit: readPositiveInteger(abuseProtection.registrationIpLimit, DEFAULT_CONFIG.abuseProtection.registrationIpLimit, 1, 100),
      registrationWindowMinutes: readPositiveInteger(abuseProtection.registrationWindowMinutes, DEFAULT_CONFIG.abuseProtection.registrationWindowMinutes, 1, 1440),
      recoveryIpLimit: readPositiveInteger(abuseProtection.recoveryIpLimit, DEFAULT_CONFIG.abuseProtection.recoveryIpLimit, 1, 1000),
      recoveryAccountLimit: readPositiveInteger(abuseProtection.recoveryAccountLimit, DEFAULT_CONFIG.abuseProtection.recoveryAccountLimit, 1, 100),
      recoveryWindowMinutes: readPositiveInteger(abuseProtection.recoveryWindowMinutes, DEFAULT_CONFIG.abuseProtection.recoveryWindowMinutes, 1, 1440),
      verificationAccountLimit: readPositiveInteger(abuseProtection.verificationAccountLimit, DEFAULT_CONFIG.abuseProtection.verificationAccountLimit, 1, 100),
      verificationWindowMinutes: readPositiveInteger(abuseProtection.verificationWindowMinutes, DEFAULT_CONFIG.abuseProtection.verificationWindowMinutes, 1, 1440),
    },
    workerJobLimit: readPositiveInteger(object.workerJobLimit, DEFAULT_CONFIG.workerJobLimit, 1, 50),
    workerLeaseMs: readPositiveInteger(object.workerLeaseMs, DEFAULT_CONFIG.workerLeaseMs, 10000, 3600000),
    schedulerEnabled: object.schedulerEnabled === true,
    schedulerPollMs: readPositiveInteger(object.schedulerPollMs, DEFAULT_CONFIG.schedulerPollMs, 10000, 600000),
    renewalReminderDays: readReminderDays(object.renewalReminderDays),
    jobSchedules: {
      dailyOpportunityDigest: readJobSchedule(schedules.dailyOpportunityDigest, DEFAULT_CONFIG.jobSchedules.dailyOpportunityDigest),
      buyerResearchRefresh: readJobSchedule(schedules.buyerResearchRefresh, DEFAULT_CONFIG.jobSchedules.buyerResearchRefresh),
      portfolioSnapshot: readJobSchedule(schedules.portfolioSnapshot, DEFAULT_CONFIG.jobSchedules.portfolioSnapshot),
      renewalReminders: readJobSchedule(schedules.renewalReminders, DEFAULT_CONFIG.jobSchedules.renewalReminders),
      savedSearchDiscovery: readJobSchedule(schedules.savedSearchDiscovery, DEFAULT_CONFIG.jobSchedules.savedSearchDiscovery),
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
