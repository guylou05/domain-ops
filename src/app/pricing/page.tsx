import Link from 'next/link';
import { getPublicPlans } from '@/lib/server/public-plans';

export const dynamic = 'force-dynamic';

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export default async function PricingPage() {
  const plans = await getPublicPlans();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <section className="py-16">
        <p className="text-sm font-semibold text-brand">Pricing</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight">Domain research workflows for focused investors.</h1>
        <p className="mt-5 max-w-2xl text-slate-300">
          Start with deterministic research, saved opportunities, watchlists, buyer targets, portfolio tracking, and reporting in one workspace.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <article className="card" key={plan.name}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Built for active domain sourcing, review, and resale planning.</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{formatPrice(plan.priceCents)}</p>
                <p className="text-sm text-slate-400">per workspace/month</p>
              </div>
            </div>

            <ul className="mt-6 grid gap-3 text-sm text-slate-300">
              {plan.features.map((feature) => (
                <li className="rounded-lg border border-white/10 px-3 py-2" key={feature}>
                  {feature}
                </li>
              ))}
            </ul>

            <Link className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href={`/register?plan=${encodeURIComponent(plan.name)}`}>
              Start 14-day trial
            </Link>
          </article>
        ))}

        <article className="card">
          <h2 className="text-2xl font-bold">Enterprise</h2>
          <p className="mt-2 text-sm text-slate-400">For teams that need custom provider contracts, audit exports, and stricter controls.</p>
          <p className="mt-6 text-3xl font-bold">Custom</p>
          <ul className="mt-6 grid gap-3 text-sm text-slate-300">
            <li className="rounded-lg border border-white/10 px-3 py-2">Custom registrar and marketplace adapters</li>
            <li className="rounded-lg border border-white/10 px-3 py-2">Role and workspace policy review</li>
            <li className="rounded-lg border border-white/10 px-3 py-2">Usage, audit, and reporting exports</li>
          </ul>
          <Link className="mt-6 inline-block rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold" href="/register">
            Request access
          </Link>
        </article>
      </section>
    </main>
  );
}
