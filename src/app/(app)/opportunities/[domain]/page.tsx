import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addOpportunityToWatchlist, runOpportunityDueDiligence } from '../actions';
import { getOpportunityDetail } from '@/lib/server/opportunities';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatAvailability(value: boolean | null): string {
  if (value === null) return 'Unchecked';
  return value ? 'Available' : 'Taken';
}

export default async function Detail({ params, searchParams }: { params: { domain: string }; searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const feedback = await searchParams;
  const opportunity = await getOpportunityDetail(params.domain);
  if (!opportunity) notFound();

  return (
    <div>
      <Link className="text-sm text-slate-400 hover:text-slate-100" href="/opportunities">
        Back to opportunities
      </Link>

      {feedback?.error ? <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-200">{feedback.error}</p> : null}
      {feedback?.notice ? <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">{feedback.notice}</p> : null}

      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">{opportunity.domain}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {opportunity.source} · {formatAvailability(opportunity.available)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runOpportunityDueDiligence}>
            <input name="domain" type="hidden" value={opportunity.domain} />
            <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Run due diligence</button>
          </form>
          <form action={addOpportunityToWatchlist}>
            <input name="domain" type="hidden" value={opportunity.domain} />
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Save to watchlist</button>
          </form>
          <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
            {opportunity.registrar ?? 'No registrar check'} · {opportunity.premium ? 'Premium' : 'Standard'}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <p className="text-slate-400">Opportunity score</p>
          <p className="mt-2 text-5xl font-bold">{opportunity.score}</p>
        </div>
        <div className="card">
          <p className="text-slate-400">Resale valuation</p>
          <p className="mt-2 text-2xl font-bold">
            {formatCurrency(opportunity.retailMin)}-{formatCurrency(opportunity.retailMax)}
          </p>
        </div>
        <div className="card">
          <p className="text-slate-400">Overall risk</p>
          <p className="mt-2 text-2xl font-bold">{opportunity.riskLevel}</p>
        </div>
      </div>

      <section className="card mt-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-xl font-semibold">Score breakdown</h2>
            {opportunity.scoreSummary ? <p className="mt-1 text-sm text-slate-400">{opportunity.scoreSummary}</p> : null}
          </div>
          <p className="text-sm text-slate-400">Buyers: {opportunity.buyerCount}</p>
        </div>

        {opportunity.factors.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No saved factor breakdown is available for this opportunity yet.</p>
        ) : (
          opportunity.factors.map((factor) => (
            <div className="mt-4" key={factor.name}>
              <div className="flex justify-between gap-4">
                <span>{factor.name}</span>
                <span>
                  {factor.value}/{factor.maxValue}
                </span>
              </div>
              <p className="text-sm text-slate-400">{factor.explanation}</p>
            </div>
          ))
        )}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="font-semibold">Trademark screening</h2>
          {opportunity.trademark ? (
            <div className="mt-3 text-sm">
              <p className={opportunity.trademark.riskLevel === 'LOW' ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-200'}>{opportunity.trademark.riskLevel} risk</p>
              <p className="mt-2 text-slate-300">{opportunity.trademark.matches.length ? opportunity.trademark.matches.join(', ') : 'No matches returned.'}</p>
              <p className="mt-2 text-xs text-slate-500">{opportunity.trademark.disclaimer}</p>
            </div>
          ) : <p className="mt-3 text-sm text-slate-400">Not screened yet.</p>}
        </div>
        <div className="card">
          <h2 className="font-semibold">Domain history</h2>
          {opportunity.history ? (
            <div className="mt-3 text-sm">
              <p className={opportunity.history.riskLevel === 'LOW' ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-200'}>{opportunity.history.riskLevel} risk</p>
              <ul className="mt-2 list-disc pl-5 text-slate-300">
                {opportunity.history.flags.map((flag) => <li key={flag}>{flag}</li>)}
              </ul>
            </div>
          ) : <p className="mt-3 text-sm text-slate-400">Not checked yet.</p>}
        </div>
        <div className="card">
          <h2 className="font-semibold">Comparable sales</h2>
          {opportunity.comparableSales.length ? (
            <dl className="mt-3 grid gap-2 text-sm">
              {opportunity.comparableSales.map((sale) => (
                <div className="flex items-center justify-between gap-3" key={`${sale.domain}-${sale.saleDate.toISOString()}`}>
                  <dt className="min-w-0 truncate text-slate-300">{sale.domain}</dt>
                  <dd className="shrink-0 font-medium">{formatCurrency(sale.price)}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-3 text-sm text-slate-400">No comparable sales saved.</p>}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Acquisition economics</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-400">Registration</dt>
            <dd className="text-right">{formatCurrency(opportunity.registrationPrice)}</dd>
            <dt className="text-slate-400">Renewal</dt>
            <dd className="text-right">{formatCurrency(opportunity.renewalPrice)}</dd>
            <dt className="text-slate-400">Wholesale</dt>
            <dd className="text-right">{formatCurrency(opportunity.valuation?.wholesale ?? null)}</dd>
            <dt className="text-slate-400">Max acquisition</dt>
            <dd className="text-right">{formatCurrency(opportunity.valuation?.maxAcquisition ?? null)}</dd>
          </dl>
        </div>

        <div className="card">
          <h2 className="font-semibold">Resale plan</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-400">Min offer</dt>
            <dd className="text-right">{formatCurrency(opportunity.valuation?.minOffer ?? null)}</dd>
            <dt className="text-slate-400">Buy now</dt>
            <dd className="text-right">{formatCurrency(opportunity.valuation?.buyNow ?? null)}</dd>
            <dt className="text-slate-400">Confidence</dt>
            <dd className="text-right">{opportunity.valuation?.confidence ?? 'Unknown'}</dd>
            <dt className="text-slate-400">Last checked</dt>
            <dd className="text-right">{opportunity.checkedAt ? opportunity.checkedAt.toLocaleDateString('en-US') : 'Unknown'}</dd>
          </dl>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="font-semibold">Notes</h2>
        <p className="mt-2 text-sm text-slate-300">
          {opportunity.valuation?.explanation ?? opportunity.notes ?? 'No saved notes are available for this opportunity.'}
        </p>
      </section>
    </div>
  );
}
