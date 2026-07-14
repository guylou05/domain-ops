import Link from 'next/link';
import { addOpportunityToWatchlist } from './actions';
import { getOpportunityList } from '@/lib/server/opportunities';
import { hasActiveParams, readParam, type SearchParams } from '@/lib/list-search-params';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatAvailability(value: boolean | null): string {
  if (value === null) return 'Unchecked';
  return value ? 'Available' : 'Taken';
}

export default async function Opportunities({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const filters = {
    search: readParam(params, 'search'),
    risk: readParam(params, 'risk', 'all'),
    availability: readParam(params, 'availability', 'all'),
    sort: readParam(params, 'sort', 'score'),
  };
  const opportunities = await getOpportunityList(filters);
  const filtered = hasActiveParams(params, ['search', 'risk', 'availability', 'sort']) && filters.sort !== 'score';
  const hasFilters = hasActiveParams(params, ['search', 'risk', 'availability']) || filtered;

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

      <form className="card mt-6 grid gap-3 lg:grid-cols-[1fr_repeat(3,180px)_auto]" action="/opportunities">
        <input
          className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          defaultValue={filters.search}
          name="search"
          placeholder="Search domains"
        />
        <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" defaultValue={filters.risk} name="risk">
          <option value="all">All risks</option>
          <option value="LOW">Low risk</option>
          <option value="MODERATE">Moderate risk</option>
          <option value="HIGH">High risk</option>
          <option value="PROHIBITED">Prohibited</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" defaultValue={filters.availability} name="availability">
          <option value="all">All availability</option>
          <option value="available">Available</option>
          <option value="taken">Taken</option>
          <option value="unchecked">Unchecked</option>
        </select>
        <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" defaultValue={filters.sort} name="sort">
          <option value="score">Score</option>
          <option value="retail">Retail value</option>
          <option value="buyers">Buyer count</option>
          <option value="checked">Recently checked</option>
          <option value="domain">Domain</option>
        </select>
        <div className="flex gap-2">
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Apply</button>
          {hasFilters ? (
            <Link className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200" href="/opportunities">
              Reset
            </Link>
          ) : null}
        </div>
      </form>

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
                <th className="pb-3">Watchlist</th>
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
                  <td className="pr-4">{opportunity.buyerCount}</td>
                  <td>
                    <form action={addOpportunityToWatchlist}>
                      <input name="domain" type="hidden" value={opportunity.domain} />
                      <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
