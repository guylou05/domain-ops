import { describe, expect, it } from 'vitest';
import { holdingDays, renewalRecommendation, saleEconomics } from '../src/lib/deal-lifecycle';

describe('deal lifecycle economics', () => {
  it('calculates proceeds, profit, and ROI after fees and acquisition cost', () => {
    expect(saleEconomics(5000, 750, 250)).toEqual({ netProceeds: 4250, netProfit: 4000, roi: 1600 });
  });

  it('calculates whole holding days', () => {
    expect(holdingDays(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T12:00:00Z'))).toBe(31);
  });
});

describe('renewal recommendations', () => {
  it('keeps holdings with an active negotiation', () => {
    expect(renewalRecommendation({ score: 30, valuation: 10, renewalCost: 20, openOffers: 1, riskLevel: 'HIGH' })).toBe('KEEP');
  });

  it('drops high-risk or uneconomic holdings and reviews borderline names', () => {
    expect(renewalRecommendation({ score: 90, valuation: 1000, renewalCost: 20, openOffers: 0, riskLevel: 'HIGH' })).toBe('DROP');
    expect(renewalRecommendation({ score: 60, valuation: 150, renewalCost: 20, openOffers: 0, riskLevel: 'LOW' })).toBe('REVIEW');
  });
});
