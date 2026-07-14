import { describe, expect, it } from 'vitest';
import {
  deterministicAvailability,
  getAvailabilityProvider,
  getAvailabilityProviderStatus,
  ProviderConfigurationError,
} from '../src/lib/providers/availability';

describe('availability provider adapters', () => {
  it('uses deterministic availability for local provider modes', async () => {
    const deterministic = await deterministicAvailability('workflowpilot.ai');
    const provider = getAvailabilityProvider('mock');
    const fromProvider = await provider.check('workflowpilot.ai');

    expect(provider.mode).toBe('mock');
    expect(fromProvider.available).toBe(deterministic.available);
    expect(fromProvider.registrationPrice).toBe(deterministic.registrationPrice);
  });

  it('reports live mode as not ready without credentials', () => {
    const status = getAvailabilityProviderStatus('live');
    expect(status.mode).toBe('live');
    expect(status.liveReady).toBe(false);
  });

  it('rejects unsupported provider modes', () => {
    expect(() => getAvailabilityProvider('unsupported')).toThrow(ProviderConfigurationError);
  });
});
