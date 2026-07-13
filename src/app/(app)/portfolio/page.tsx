import Link from 'next/link';
import { getPortfolioHoldings } from '@/lib/server/portfolio-views';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function PortfolioPage() {
  const holdings = await getPortfolioHoldings();
  const totalCost = holdings.reduce((sum, holding) => sum + holding.purchaseCost, 0);
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValuation, 0);
  const renewalExposure = holdings.reduce((sum, holding) => sum + holding.renewalCost, 0);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Active holdings with acquisition cost, renewal exposure, and current resale targets.
          </p>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/opportunities">
          Review opportunities
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-400">Acquisition cost</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalCost)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Current valuation</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Annual renewals</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(renewalExposure)}</p>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        {holdings.length === 0 ? (
          <div className="py-10 text-center">
            <h2 className="text-lg font-semibold">No portfolio holdings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Seed the demo database or add acquired domains once acquisition workflows are wired.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-3">Domain</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Cost</th>
                <th className="pb-3">Valuation</th>
                <th className="pb-3">Buy now</th>
                <th className="pb-3">Renewal</th>
                <th className="pb-3">Expires</th>
                <th className="pb-3">Registrar</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr className="border-t border-white/10" key={holding.id}>
                  <td className="py-3 pr-4">
                    <Link className="font-medium text-brand" href={`/opportunities/${encodeURIComponent(holding.domain)}`}>
                      {holding.domain}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {holding.status} · {holding.autoRenew ? 'Auto-renew on' : 'Manual renewal'}
                    </p>
                  </td>
                  <td className="pr-4">{holding.opportunityScore ?? 'Unknown'}</td>
                  <td className="pr-4">{formatCurrency(holding.purchaseCost)}</td>
                  <td className="pr-4">{formatCurrency(holding.currentValuation)}</td>
                  <td className="pr-4">{formatCurrency(holding.buyNowPrice)}</td>
                  <td className="pr-4">{formatCurrency(holding.renewalCost)}</td>
                  <td className="pr-4">{formatDate(holding.expirationDate)}</td>
                  <td>{holding.registrar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
