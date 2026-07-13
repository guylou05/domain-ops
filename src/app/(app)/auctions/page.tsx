import Link from 'next/link';
import { getAuctionListings } from '@/lib/server/auctions';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default async function AuctionsPage() {
  const listings = await getAuctionListings();
  const activeCount = listings.filter((listing) => listing.status === 'ACTIVE').length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Auctions</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Persisted marketplace listings with pricing context from opportunities and portfolio records.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
          {activeCount} active listings
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No marketplace listings yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or publish portfolio domains to marketplace channels.
          </p>
          <Link className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/portfolio">
            Open portfolio
          </Link>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-3">Domain</th>
                <th className="pb-3">Marketplace</th>
                <th className="pb-3">Ask</th>
                <th className="pb-3">Retail range</th>
                <th className="pb-3">Portfolio value</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr className="border-t border-white/10" key={listing.id}>
                  <td className="py-3 pr-4">
                    <Link className="font-medium text-brand" href={`/opportunities/${encodeURIComponent(listing.domain)}`}>
                      {listing.domain}
                    </Link>
                  </td>
                  <td className="pr-4">{listing.marketplace}</td>
                  <td className="pr-4">{formatCurrency(listing.price)}</td>
                  <td className="pr-4">
                    {formatCurrency(listing.retailMin)}-{formatCurrency(listing.retailMax)}
                  </td>
                  <td className="pr-4">{formatCurrency(listing.portfolioValue)}</td>
                  <td className="pr-4">{listing.opportunityScore ?? 'Unknown'}</td>
                  <td>{listing.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
