import { describe, expect, it } from 'vitest';
import { analyzeDomains, generateDomainIdeas, mockAvailability, scoreDomain } from '../src/lib/domain-engine';

describe('domain engine', () => {
  it('generates bounded ideas and explainable scores', async () => {
    const ideas = generateDomainIdeas({ concept:'automation', industry:'AI', keywords:['agent'], tlds:['.com'], count:3, maxLength:18 });
    expect(ideas).toHaveLength(3);
    const [analysis] = await analyzeDomains([ideas[0] ?? 'agenthub.com'], 'AI');
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.factors.length).toBeGreaterThan(3);
  });

  it('keeps scoring deterministic for a fixed availability result', async () => {
    const availability = await mockAvailability('workflowpilot.ai');
    const first = scoreDomain(availability, 'SaaS');
    const second = scoreDomain(availability, 'SaaS');

    expect(second.score).toBe(first.score);
    expect(second.valuation.buyNow).toBe(first.valuation.buyNow);
    expect(second.riskLevel).toBe(first.riskLevel);
  });
});
