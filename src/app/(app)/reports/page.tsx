import Link from 'next/link';
import { createPortfolioSnapshotReport } from './actions';
import { getReports } from '@/lib/server/reports';

export const dynamic = 'force-dynamic';

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatType(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Persisted workspace snapshots for portfolio review, opportunity triage, and operating cadence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={createPortfolioSnapshotReport}>
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Generate snapshot</button>
          </form>
          <Link className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200" href="/overview">
            Open dashboard
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No saved reports yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or generate report records from future analysis jobs.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {reports.map((report) => (
            <article className="card" key={report.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">{formatType(report.type)}</p>
                  <h2 className="mt-1 text-xl font-semibold">{report.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">{report.summary}</p>
                </div>
                <p className="text-sm text-slate-400">{formatDate(report.createdAt)}</p>
              </div>

              {report.metrics.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {report.metrics.map((metric) => (
                    <div className="rounded-lg bg-white/5 p-3" key={metric.label}>
                      <p className="text-xs text-slate-400">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {report.highlights.length > 0 ? (
                <ul className="mt-5 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                  {report.highlights.map((highlight) => (
                    <li className="rounded-lg border border-white/10 px-3 py-2" key={highlight}>
                      {highlight}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
