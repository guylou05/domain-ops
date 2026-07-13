import Link from 'next/link';
import { getOpportunityList } from '@/lib/server/opportunities';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatAvailability(value: boolean | null): string {
  if (value === null) return 'Unchecked';
  return value ? 'Available' : 'Taken';
}

export default async function Opportunities() {
  const opportunities = await getOpportunityList();

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Opportunities</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Ranked domains saved from generator, manual, CSV, and seeded workflows.
          </p>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/domain-generator">
          Add domains
        </Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        {opportunities.length === 0 ? (
          <div className="py-10 text-center">
            <h2 className="text-lg font-semibold">No saved opportunities yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Generate or import domains to persist availability checks, scores, and valuation ranges.
            </p>
            <Link className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/domain-generator">
              Open generator
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-3">Domain</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Availability</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Retail range</th>
                <th className="pb-3">Risk</th>
                <th className="pb-3">Buyers</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity) => (
                <tr className="border-t border-white/10" key={opportunity.domain}>
                  <td className="py-3 pr-4">
                    <Link className="font-medium text-brand" href={`/opportunities/${encodeURIComponent(opportunity.domain)}`}>
                      {opportunity.domain}
                    </Link>
                  </td>
                  <td className="pr-4">{opportunity.score}</td>
                  <td className="pr-4">{formatAvailability(opportunity.available)}</td>
                  <td className="pr-4">{formatCurrency(opportunity.registrationPrice)}</td>
                  <td className="pr-4">
                    {formatCurrency(opportunity.retailMin)}-{formatCurrency(opportunity.retailMax)}
                  </td>
                  <td className="pr-4">{opportunity.riskLevel}</td>
                  <td>{opportunity.buyerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
