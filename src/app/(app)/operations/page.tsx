import { CheckCircle2, CircleAlert, Clock3 } from 'lucide-react';
import { getOperationsView } from '@/lib/server/operations';
import { resolveFailure, runRetentionNow, updateObservabilitySettings } from './actions';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null): string {
  return value ? value.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No events yet';
}

function formatLabel(value: string): string {
  return value.split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

export default async function OperationsPage({ searchParams }: { searchParams?: Promise<{ source?: string; outcome?: string }> }) {
  const [operations, query] = await Promise.all([getOperationsView(), searchParams]);
  const events = operations.recentEvents.filter((event) =>
    (!query?.source || query.source === 'all' || event.source === query.source)
    && (!query?.outcome || query.outcome === 'all' || event.outcome === query.outcome),
  );
  const unresolved = operations.unresolvedEvents;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Operations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Runtime health, structured telemetry, failure resolution, alert routing, and retention.</p>
        </div>
        <div className={operations.unresolvedFailures ? 'flex items-center gap-2 text-sm font-semibold text-amber-200' : 'flex items-center gap-2 text-sm font-semibold text-emerald-300'}>
          {operations.unresolvedFailures ? <CircleAlert size={17} /> : <CheckCircle2 size={17} />}
          {operations.unresolvedFailures ? `${operations.unresolvedFailures} unresolved` : 'Operational'}
        </div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[['Recent events', operations.recentEvents.length], ['Failures in 24h', operations.failures24h], ['Unresolved failures', operations.unresolvedFailures]].map(([label, value]) => (
          <div className="card" key={label}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>
        ))}
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-semibold">Source health</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-slate-400"><th className="pb-3">Source</th><th className="pb-3">Status</th><th className="pb-3">Unresolved</th><th className="pb-3">Latest event</th></tr></thead>
            <tbody>{operations.sources.map((source) => (
              <tr className="border-t border-white/10" key={source.source}>
                <td className="py-3 pr-4 font-semibold">{formatLabel(source.source)}</td>
                <td className="pr-4"><span className={source.status === 'healthy' ? 'text-emerald-300' : source.status === 'degraded' ? 'text-amber-200' : 'text-slate-500'}>{formatLabel(source.status)}</span></td>
                <td className="pr-4">{source.failures}</td><td className="text-slate-400">{formatDate(source.latestAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {operations.canManage ? (
        <section className="card mt-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><h2 className="text-xl font-semibold">Alert routing and retention</h2><p className="mt-1 text-sm text-slate-400">Email delivery: {operations.alertDeliveryReady ? 'Ready' : 'Not configured'}</p></div>
            <form action={runRetentionNow}><button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/10">Run retention now</button></form>
          </div>
          <form action={updateObservabilitySettings} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">Retention days<input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={operations.observability.retentionDays} max={365} min={7} name="retentionDays" type="number" /></label>
            <label className="grid gap-2 text-sm text-slate-300">Alert cooldown minutes<input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={operations.observability.alertCooldownMinutes} max={1440} min={5} name="alertCooldownMinutes" type="number" /></label>
            <label className="grid gap-2 text-sm text-slate-300">Minimum alert level<select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={operations.observability.alertMinimumLevel} name="alertMinimumLevel"><option value="ERROR">Error</option><option value="WARN">Warning</option></select></label>
            <label className="flex items-center gap-3 self-end rounded-lg border border-white/10 px-3 py-2 text-sm"><input defaultChecked={operations.observability.emailAlertsEnabled} name="emailAlertsEnabled" type="checkbox" /><span>Enable operational email alerts</span></label>
            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">Alert recipients<input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={operations.observability.emailRecipients.join(', ')} name="emailRecipients" placeholder="ops@example.com, owner@example.com" /></label>
            <div className="md:col-span-2"><button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Save observability settings</button></div>
          </form>
        </section>
      ) : null}

      <section className="card mt-6">
        <h2 className="text-xl font-semibold">Unresolved failures</h2>
        {unresolved.length === 0 ? <p className="mt-4 text-sm text-slate-400">No unresolved workspace failures.</p> : (
          <div className="mt-4 grid gap-3">{unresolved.map((event) => (
            <div className="flex flex-col justify-between gap-3 border-l-2 border-amber-300/50 pl-3 sm:flex-row sm:items-start" key={event.id}>
              <div><p className="text-sm font-semibold">{formatLabel(event.event)}</p><p className="mt-1 text-sm text-slate-300">{event.message}</p><p className="mt-1 text-xs text-slate-500">{formatLabel(event.source)} / {formatDate(event.occurredAt)}</p></div>
              {operations.canManage ? <form action={resolveFailure}><input name="id" type="hidden" value={event.id} /><button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Resolve</button></form> : null}
            </div>
          ))}</div>
        )}
      </section>

      <section className="card mt-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <h2 className="text-xl font-semibold">Event history</h2>
          <form className="flex gap-2">
            <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" defaultValue={query?.source ?? 'all'} name="source"><option value="all">All sources</option>{operations.sources.map((source) => <option key={source.source} value={source.source}>{formatLabel(source.source)}</option>)}</select>
            <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" defaultValue={query?.outcome ?? 'all'} name="outcome"><option value="all">All outcomes</option><option value="SUCCESS">Success</option><option value="FAILURE">Failure</option></select>
            <button aria-label="Apply event filters" className="grid size-10 place-items-center rounded-lg border border-white/10" title="Apply filters"><Clock3 size={16} /></button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-slate-400"><th className="pb-3">Event</th><th className="pb-3">Source</th><th className="pb-3">Outcome</th><th className="pb-3">Duration</th><th className="pb-3">When</th></tr></thead><tbody>{events.map((event) => <tr className="border-t border-white/10" key={event.id}><td className="py-3 pr-4"><p className="font-semibold">{formatLabel(event.event)}</p><p className="mt-1 max-w-xl text-xs text-slate-500">{event.message}</p></td><td className="pr-4">{formatLabel(event.source)}</td><td className={event.outcome === 'SUCCESS' ? 'pr-4 text-emerald-300' : 'pr-4 text-amber-200'}>{formatLabel(event.outcome)}</td><td className="pr-4">{event.durationMs == null ? '-' : `${event.durationMs} ms`}</td><td className="text-slate-400">{formatDate(event.occurredAt)}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
