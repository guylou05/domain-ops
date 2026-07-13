import { describe, expect, it } from 'vitest';
import { analyzeDomains, generateDomainIdeas } from '../src/lib/domain-engine';

describe('domain engine', () => {
  it('generates bounded ideas and explainable scores', async () => {
    const ideas = generateDomainIdeas({ concept:'automation', industry:'AI', keywords:['agent'], tlds:['.com'], count:3, maxLength:18 });
    expect(ideas).toHaveLength(3);
    const [analysis] = await analyzeDomains([ideas[0] ?? 'agenthub.com'], 'AI');
    expect(analysis.score).toBeGreaterThan(0);
    expect(analysis.factors.length).toBeGreaterThan(3);
  });
});
