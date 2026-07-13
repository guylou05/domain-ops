import Link from 'next/link';
import { getWatchlists } from '@/lib/server/portfolio-views';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default async function WatchlistsPage() {
  const watchlists = await getWatchlists();

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Watchlists</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Workspace collections for tracking domains before acquisition or outreach.
          </p>
        </div>
        <Link className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/opportunities">
          Browse opportunities
        </Link>
      </div>

      {watchlists.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No watchlists yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or save opportunities into a watchlist as the workflow expands.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {watchlists.map((watchlist) => (
            <section className="card" key={watchlist.id}>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">{watchlist.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">{watchlist.notes ?? 'No notes saved for this watchlist.'}</p>
                </div>
                <p className="text-sm text-slate-400">
                  {watchlist.itemCount} {watchlist.itemCount === 1 ? 'domain' : 'domains'}
                </p>
              </div>

              {watchlist.items.length === 0 ? (
                <p className="mt-5 rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
                  No domains have been added to this watchlist yet.
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="pb-3">Domain</th>
                        <th className="pb-3">Score</th>
                        <th className="pb-3">Retail range</th>
                        <th className="pb-3">Risk</th>
                        <th className="pb-3">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {watchlist.items.map((item) => (
                        <tr className="border-t border-white/10" key={item.domain}>
                          <td className="py-3 pr-4">
                            <Link className="font-medium text-brand" href={`/opportunities/${encodeURIComponent(item.domain)}`}>
                              {item.domain}
                            </Link>
                            {item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
                          </td>
                          <td className="pr-4">{item.score ?? 'Unknown'}</td>
                          <td className="pr-4">
                            {formatCurrency(item.retailMin)}-{formatCurrency(item.retailMax)}
                          </td>
                          <td className="pr-4">{item.riskLevel ?? 'Unknown'}</td>
                          <td>
                            {item.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {item.tags.map((tag) => (
                                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300" key={tag}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
