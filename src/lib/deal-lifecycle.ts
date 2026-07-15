export type RenewalRecommendation = 'KEEP' | 'REVIEW' | 'DROP';

export function saleEconomics(salePrice: number, fees: number, purchaseCost: number) {
  const netProceeds = salePrice - fees;
  const netProfit = netProceeds - purchaseCost;
  const roi = purchaseCost > 0 ? (netProfit / purchaseCost) * 100 : 0;
  return { netProceeds, netProfit, roi };
}

export function renewalRecommendation(input: {
  score: number | null;
  valuation: number;
  renewalCost: number;
  openOffers: number;
  riskLevel: string | null;
}): RenewalRecommendation {
  if (input.openOffers > 0) return 'KEEP';
  if (input.riskLevel === 'HIGH' || input.valuation < input.renewalCost * 3) return 'DROP';
  if ((input.score ?? 0) >= 70 && input.valuation >= input.renewalCost * 10) return 'KEEP';
  return 'REVIEW';
}

export function holdingDays(purchaseDate: Date, endDate: Date): number {
  return Math.max(0, Math.floor((endDate.getTime() - purchaseDate.getTime()) / 86400000));
}
