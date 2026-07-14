import Link from 'next/link';
import { runHistoryChecks } from './actions';
import { getExpiredDomainHistory } from '@/lib/server/expired-domains';

export const dynamic = 'force-dynamic';

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function ExpiredDomainsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const error = (await searchParams)?.error;
  const checks = await getExpiredDomainHistory();
  const highRiskCount = checks.filter((check) => check.riskLevel === 'HIGH' || check.riskLevel === 'PROHIBITED').length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Expired domains</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Historical risk checks for expired or previously owned domains in the workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
            {highRiskCount} high-risk checks
          </div>
          <form action={runHistoryChecks}>
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Run checks</button>
          </form>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}

      {checks.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No history checks yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or run history checks before acquiring expired domains.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <form action={runHistoryChecks}>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Run checks</button>
            </form>
            <Link className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200" href="/opportunities">
              Review opportunities
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {checks.map((check) => (
            <article className="card" key={check.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <Link className="text-xl font-semibold text-brand" href={`/opportunities/${encodeURIComponent(check.domain)}`}>
                    {check.domain}
                  </Link>
                  <p className="mt-1 text-sm text-slate-400">
                    Score: {check.score ?? 'Unknown'} · Checked {formatDate(check.checkedAt)}
                  </p>
                </div>
                <span className={check.riskLevel === 'LOW' ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-amber-200'}>
                  {check.riskLevel}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-white/5 p-3">
                  <h2 className="font-semibold">Flags</h2>
                  {check.flags.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No flags saved.</p>
                  ) : (
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-300">
                      {check.flags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg bg-white/5 p-3">
                  <h2 className="font-semibold">Evidence</h2>
                  {check.evidence.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No evidence saved.</p>
                  ) : (
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-300">
                      {check.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
