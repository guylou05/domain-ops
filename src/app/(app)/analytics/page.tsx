import { getAnalytics } from '@/lib/server/analytics';

export const dynamic = 'force-dynamic';

function formatCurrencyFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLabel(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Operating metrics from persisted opportunity, portfolio, marketplace, usage, and AI cost records.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {analytics.metrics.map((metric) => (
          <div className="card" key={metric.label}>
            <p className="text-sm text-slate-400">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="text-xl font-semibold">Risk mix</h2>
          {analytics.riskMix.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No opportunity risk data yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.riskMix.map((item) => (
                <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm" key={item.label}>
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">Usage</h2>
          {analytics.usage.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No usage records yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.usage.map((item) => (
                <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm" key={item.key}>
                  <span>{formatLabel(item.key)}</span>
                  <span className="font-semibold">{item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">AI spend</h2>
          {analytics.aiUsage.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No AI usage records yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.aiUsage.map((item) => (
                <div className="rounded-lg bg-white/5 px-3 py-2 text-sm" key={`${item.model}-${item.createdAt.toISOString()}`}>
                  <div className="flex justify-between gap-3">
                    <span>{item.model}</span>
                    <span className="font-semibold">{formatCurrencyFromCents(item.costCents)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.tokens.toLocaleString()} tokens · {formatDate(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
