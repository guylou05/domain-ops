import Link from 'next/link';
import { generateDomainIdeas } from '@/lib/domain-engine';
import { getOpportunityList } from '@/lib/server/opportunities';
import { GenerateDomainsForm, ImportDomainsForm } from './forms';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number | null): string {
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default async function Generator() {
  const ideas = generateDomainIdeas({
    concept: 'automation',
    industry: 'AI',
    keywords: ['agent', 'workflow', 'sales'],
    tlds: ['.com', '.ai'],
    count: 8,
    maxLength: 18,
  });
  const recentOpportunities = (await getOpportunityList()).slice(0, 6);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-brand">Workspace workflow</p>
        <h1 className="mt-2 text-3xl font-bold">Domain Generator</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Generate ideas, run deterministic registrar availability, calculate explainable scores, and save opportunities into the workspace database for downstream review.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GenerateDomainsForm />
        <ImportDomainsForm />
      </div>

      <section className="card">
        <h2 className="text-xl font-semibold">Recently saved opportunities</h2>
        {recentOpportunities.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No opportunities have been saved yet. Generate or import domains to populate this workspace.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentOpportunities.map((opportunity) => (
              <Link className="rounded-xl border border-white/10 p-3 hover:bg-white/5" href={`/opportunities/${encodeURIComponent(opportunity.domain)}`} key={opportunity.domain}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-brand">{opportunity.domain}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs">{opportunity.score}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {formatCurrency(opportunity.registrationPrice)} buy · {formatCurrency(opportunity.retailMin)}-{formatCurrency(opportunity.retailMax)} retail · {opportunity.riskLevel}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold">Example ideas</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {ideas.map((idea) => (
            <div className="rounded-xl border border-white/10 p-3" key={idea}>
              {idea}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
