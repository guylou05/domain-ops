import Link from 'next/link';
import { generateBuyerTargets } from './actions';
import { getBuyerResearch } from '@/lib/server/buyer-research';

export const dynamic = 'force-dynamic';

export default async function BuyerResearchPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const error = (await searchParams)?.error;
  const buyers = await getBuyerResearch();
  const readyCount = buyers.filter((buyer) => buyer.outreachStatus === 'READY').length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Buyer research</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Persisted buyer targets mapped to domains, relevance scores, contacts, and outreach readiness.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
            {readyCount} ready for outreach
          </div>
          <form action={generateBuyerTargets}>
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Generate targets</button>
          </form>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}

      {buyers.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No buyer research yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or run buyer research jobs to populate company targets.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <form action={generateBuyerTargets}>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Generate targets</button>
            </form>
            <Link className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200" href="/opportunities">
              Review opportunities
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {buyers.map((buyer) => (
            <article className="card" key={buyer.id}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold">{buyer.companyName}</h2>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300">{buyer.outreachStatus}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {buyer.industry}
                    {buyer.location ? ` · ${buyer.location}` : ''}
                  </p>
                  <p className="mt-3 max-w-3xl text-sm text-slate-300">{buyer.reasonForFit}</p>
                </div>
                <div className="min-w-40 rounded-lg bg-white/5 p-3 text-sm">
                  <p className="text-slate-400">Relevance</p>
                  <p className="mt-1 text-2xl font-bold">{buyer.relevanceScore}/100</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_2fr]">
                <div className="rounded-lg border border-white/10 p-3 text-sm">
                  <p className="text-slate-400">Matched domain</p>
                  <Link className="mt-1 block font-medium text-brand" href={`/opportunities/${encodeURIComponent(buyer.domain)}`}>
                    {buyer.domain}
                  </Link>
                  <p className="mt-2 text-slate-400">Opportunity score: {buyer.opportunityScore ?? 'Unknown'}</p>
                  {buyer.website ? (
                    <a className="mt-2 block text-brand" href={buyer.website} rel="noreferrer" target="_blank">
                      Company site
                    </a>
                  ) : null}
                </div>

                <div className="rounded-lg border border-white/10 p-3">
                  <h3 className="font-semibold">Contacts</h3>
                  {buyer.contacts.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">No contacts saved for this buyer.</p>
                  ) : (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {buyer.contacts.map((contact) => (
                        <div className="rounded-lg bg-white/5 p-3 text-sm" key={`${buyer.id}-${contact.email ?? contact.name}`}>
                          <p className="font-medium">{contact.name ?? 'Unknown contact'}</p>
                          <p className="mt-1 text-slate-400">{contact.title ?? 'Title unknown'}</p>
                          {contact.email ? <p className="mt-2 text-slate-300">{contact.email}</p> : null}
                          {contact.linkedinUrl ? (
                            <a className="mt-2 block text-brand" href={contact.linkedinUrl} rel="noreferrer" target="_blank">
                              LinkedIn
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
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
