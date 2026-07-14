import { describe, expect, it } from 'vitest';
import { parseAppConfig } from '../src/lib/server/app-config';

describe('app config parsing', () => {
  it('uses safe defaults for missing runtime settings', () => {
    expect(parseAppConfig(undefined)).toEqual({
      availabilityProvider: 'mock',
      authDiagnosticsEnabled: false,
      workerJobLimit: 5,
      workerLeaseMs: 300000,
    });
  });

  it('normalizes runtime settings from persisted JSON', () => {
    expect(
      parseAppConfig({
        availabilityProvider: 'live',
        authDiagnosticsEnabled: true,
        workerJobLimit: 200,
        workerLeaseMs: 1000,
      }),
    ).toEqual({
      availabilityProvider: 'live',
      authDiagnosticsEnabled: true,
      workerJobLimit: 50,
      workerLeaseMs: 10000,
    });
  });
});
