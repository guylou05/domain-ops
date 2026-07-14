import { z } from 'zod';
import { deterministicAvailability, getAvailabilityProvider, type AvailabilityResult } from './providers/availability';

export const generationSchema = z.object({
  concept: z.string().min(2),
  industry: z.string().min(2),
  keywords: z.array(z.string()).min(1),
  location: z.string().optional(),
  tlds: z.array(z.string()).default(['.com']),
  maxLength: z.number().int().min(6).max(30).default(18),
  count: z.number().int().min(1).max(50).default(20),
});
export type GenerationInput = z.infer<typeof generationSchema>;
export type ScoreFactor = { name: string; value: number; maxValue: number; explanation: string };
export type DomainAnalysis = AvailabilityResult & { score: number; riskLevel: 'LOW'|'MODERATE'|'HIGH'|'PROHIBITED'; buyerCount: number; valuation: { wholesale: number; retailMin: number; retailMax: number; buyNow: number; maxAcquisition: number; confidence: string }; factors: ScoreFactor[]; strengths: string[]; weaknesses: string[] };

const suffixes = ['labs','hub','pilot','forge','loop','signal','market','base','pros','wise','stack','rocket'];
export function generateDomainIdeas(input: GenerationInput): string[] {
  const parsed = generationSchema.parse(input);
  const roots = [parsed.industry, parsed.concept, ...parsed.keywords, parsed.location].filter(Boolean).map((v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, ''));
  const ideas = new Set<string>();
  for (const root of roots) for (const suffix of suffixes) for (const tld of parsed.tlds) {
    const name = `${root}${suffix}${tld.startsWith('.') ? tld : `.${tld}`}`;
    if (name.length <= parsed.maxLength + tld.length) ideas.add(name);
  }
  return [...ideas].slice(0, parsed.count);
}

export async function mockAvailability(domain: string): Promise<AvailabilityResult> {
  return deterministicAvailability(domain);
}

export function scoreDomain(result: AvailabilityResult, industry = 'general'): DomainAnalysis {
  const label = result.domain.split('.')[0] ?? result.domain;
  const tld = result.domain.slice(result.domain.lastIndexOf('.'));
  const lengthScore = Math.max(0, 15 - Math.max(0, label.length - 8));
  const tldScore = tld === '.com' ? 10 : ['.io','.ai','.co'].includes(tld) ? 8 : 5;
  const economics = result.available ? Math.max(0, 15 - Math.floor(result.registrationPrice / 25)) : 2;
  const brandability = /[aeiou]/.test(label) && !/\d|-/.test(label) ? 14 : 8;
  const buyerDemand = Math.min(15, 6 + industry.length);
  const riskPenalty = result.premium ? -4 : 0;
  const factors: ScoreFactor[] = [
    { name: 'Commercial intent', value: buyerDemand, maxValue: 15, explanation: `Industry demand signal for ${industry}.` },
    { name: 'Brandability', value: brandability, maxValue: 15, explanation: 'Pronounceable names without digits or hyphens score higher.' },
    { name: 'Domain length', value: lengthScore, maxValue: 15, explanation: 'Shorter names are easier to remember and resell.' },
    { name: 'Extension quality', value: tldScore, maxValue: 10, explanation: 'Extension liquidity and buyer familiarity.' },
    { name: 'Acquisition economics', value: economics, maxValue: 15, explanation: 'Lower registration and renewal costs improve ROI.' },
    { name: 'Risk adjustment', value: riskPenalty, maxValue: 0, explanation: 'Premium pricing or legal signals reduce the score.' },
  ];
  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.value, 24)));
  const buyerCount = Math.max(3, Math.floor(score / 7));
  return { ...result, score, riskLevel: score > 75 ? 'LOW' : score > 55 ? 'MODERATE' : 'HIGH', buyerCount, valuation: { wholesale: result.registrationPrice * 2, retailMin: score * 35, retailMax: score * 95, buyNow: score * 120, maxAcquisition: Math.round(score * 1.8), confidence: score > 70 ? 'Medium' : 'Low' }, factors, strengths: ['Explainable score', `${result.registrar} checked`, 'Manual approval required'], weaknesses: result.premium ? ['Premium acquisition cost'] : ['Development provider data should be verified before acquisition'] };
}

export async function analyzeDomains(domains: string[], industry: string): Promise<DomainAnalysis[]> {
  const provider = getAvailabilityProvider();
  return Promise.all(domains.map(async (domain) => scoreDomain(await provider.check(domain), industry)));
}

export async function analyzeDomainsWithProviderMode(domains: string[], industry: string, providerMode: string): Promise<DomainAnalysis[]> {
  const provider = getAvailabilityProvider(providerMode);
  return Promise.all(domains.map(async (domain) => scoreDomain(await provider.check(domain), industry)));
}
