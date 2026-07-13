import Link from 'next/link';
import { getDashboardSummary } from '@/lib/server/dashboard';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default async function Dashboard() {
  const summary = await getDashboardSummary();
  const metrics = [
    ['Analyzed domains', summary.analyzedDomains],
    ['Qualified opportunities', summary.qualifiedOpportunities],
    ['Average score', summary.averageScore || 'None'],
    ['Estimated retail floor', formatCurrency(summary.estimatedRetailValue)],
    ['Portfolio value', formatCurrency(summary.portfolioValue)],
    ['Annual renewals', formatCurrency(summary.renewalExposure)],
    ['Watchlists', summary.watchlistCount],
  ];

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Executive dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Live workspace snapshot from persisted opportunities, watchlists, and portfolio records.
          </p>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/domain-generator">
          Generate domains
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="card">
          <h2 className="text-xl font-semibold">Risk mix</h2>
          {summary.riskBreakdown.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No active opportunity risk data yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {summary.riskBreakdown.map((item) => (
                <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm" key={item.riskLevel}>
                  <span>{item.riskLevel}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Best opportunities</h2>
            <Link className="text-sm text-brand" href="/opportunities">
              View all
            </Link>
          </div>

          {summary.topOpportunities.length === 0 ? (
            <div className="py-8 text-center">
              <h3 className="font-semibold">No opportunities yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                Generate or import domains to populate the dashboard with scored opportunities.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {summary.topOpportunities.map((opportunity) => (
                <article className="rounded-lg border border-white/10 bg-white/5 p-4" key={opportunity.domain}>
                  <div className="flex items-start justify-between gap-3">
                    <Link className="font-semibold text-brand" href={`/opportunities/${encodeURIComponent(opportunity.domain)}`}>
                      {opportunity.domain}
                    </Link>
                    <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">{opportunity.score}/100</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {formatCurrency(opportunity.registrationPrice)} buy · {formatCurrency(opportunity.retailMin)}-
                    {formatCurrency(opportunity.retailMax)} retail · {opportunity.buyerCount} buyers · {opportunity.riskLevel}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
