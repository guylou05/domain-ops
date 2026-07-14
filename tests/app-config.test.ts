import { describe, expect, it } from 'vitest';
import { parseAppConfig } from '../src/lib/server/app-config';

describe('app config parsing', () => {
  it('uses safe defaults for missing runtime settings', () => {
    expect(parseAppConfig(undefined)).toEqual({
      availabilityProvider: 'mock',
      authDiagnosticsEnabled: false,
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
        authDiagnosticsEnabled: true,
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
      authDiagnosticsEnabled: true,
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
