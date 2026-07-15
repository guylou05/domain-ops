import { describe, expect, it } from 'vitest';
import { parseAppConfig } from '../src/lib/server/app-config';

describe('app config parsing', () => {
  it('uses safe defaults for missing runtime settings', () => {
    expect(parseAppConfig(undefined)).toEqual({
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
      billing: { mode: 'off', currency: 'usd' },
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
      jobSchedules: {
        dailyOpportunityDigest: { enabled: true, intervalMinutes: 1440 },
        buyerResearchRefresh: { enabled: true, intervalMinutes: 360 },
        portfolioSnapshot: { enabled: true, intervalMinutes: 1440 },
      },
    });
  });

  it('normalizes runtime settings from persisted JSON', () => {
    expect(
      parseAppConfig({
        availabilityProvider: 'live',
        trademarkProvider: 'deterministic',
        comparableSalesProvider: 'live',
        historyProvider: 'unsupported',
        providerEndpoints: {
          registrar: 'https://providers.example/registrar',
          trademark: 'not-a-url',
          comparableSales: 'https://providers.example/sales',
        },
        authDiagnosticsEnabled: true,
        transactionalEmail: {
          enabled: true,
          sender: 'DomainScout AI <security@example.com>',
          endpoint: 'https://api.resend.com/emails',
        },
        billing: { mode: 'live', currency: 'CAD' },
        observability: {
          retentionDays: 500,
          alertMinimumLevel: 'WARN',
          emailAlertsEnabled: true,
          emailRecipients: [' OPS@example.com ', 'invalid'],
          alertCooldownMinutes: 1,
        },
        abuseProtection: {
          enabled: false,
          loginIpLimit: 2,
          loginAccountLimit: 500,
          loginWindowMinutes: 0,
          registrationIpLimit: 500,
          registrationWindowMinutes: 5000,
          recoveryIpLimit: 0,
          recoveryAccountLimit: 0,
          recoveryWindowMinutes: 5,
          verificationAccountLimit: 500,
          verificationWindowMinutes: 0,
        },
        workerJobLimit: 200,
        workerLeaseMs: 1000,
        schedulerEnabled: true,
        schedulerPollMs: 1000,
        jobSchedules: {
          dailyOpportunityDigest: { enabled: false, intervalMinutes: 1 },
        },
      }),
    ).toEqual({
      availabilityProvider: 'live',
      trademarkProvider: 'deterministic',
      comparableSalesProvider: 'live',
      historyProvider: 'mock',
      providerEndpoints: {
        registrar: 'https://providers.example/registrar',
        trademark: '',
        comparableSales: 'https://providers.example/sales',
        history: '',
      },
      authDiagnosticsEnabled: true,
      transactionalEmail: {
        enabled: true,
        sender: 'DomainScout AI <security@example.com>',
        endpoint: 'https://api.resend.com/emails',
      },
      billing: { mode: 'live', currency: 'cad' },
      observability: {
        retentionDays: 365,
        alertMinimumLevel: 'WARN',
        emailAlertsEnabled: true,
        emailRecipients: ['ops@example.com'],
        alertCooldownMinutes: 5,
      },
      abuseProtection: {
        enabled: false,
        loginIpLimit: 5,
        loginAccountLimit: 100,
        loginWindowMinutes: 15,
        registrationIpLimit: 100,
        registrationWindowMinutes: 1440,
        recoveryIpLimit: 10,
        recoveryAccountLimit: 3,
        recoveryWindowMinutes: 5,
        verificationAccountLimit: 100,
        verificationWindowMinutes: 60,
      },
      workerJobLimit: 50,
      workerLeaseMs: 10000,
      schedulerEnabled: true,
      schedulerPollMs: 10000,
      jobSchedules: {
        dailyOpportunityDigest: { enabled: false, intervalMinutes: 5 },
        buyerResearchRefresh: { enabled: true, intervalMinutes: 360 },
        portfolioSnapshot: { enabled: true, intervalMinutes: 1440 },
      },
    });
  });
});
