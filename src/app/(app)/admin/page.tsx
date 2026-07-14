import { queueBackgroundJob, toggleFeatureFlag } from './actions';
import { getAdminDashboard } from '@/lib/server/admin';
import { getRegisteredWorkerTasks } from '@/worker/task-registry';

export const dynamic = 'force-dynamic';

function formatDate(value: Date): string {
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLabel(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default async function AdminPage() {
  const dashboard = await getAdminDashboard();
  const workerTasks = getRegisteredWorkerTasks();
  const metrics = [
    ['Members', dashboard.counts.users],
    ['Active domains', dashboard.counts.activeDomains],
    ['Opportunities', dashboard.counts.activeOpportunities],
    ['Active jobs', dashboard.counts.activeJobs],
  ];

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Workspace operations, background jobs, audit activity, and feature flag visibility.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
          Role: {dashboard.role}
        </div>
      </div>

      {!dashboard.canAdminister ? (
        <div className="card mt-6 border-amber-400/30 bg-amber-400/5">
          <h2 className="font-semibold text-amber-200">Limited access</h2>
          <p className="mt-2 text-sm text-slate-300">Your role can view this workspace, but admin actions require OWNER or ADMIN access.</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <h2 className="text-xl font-semibold">Background jobs</h2>
            {dashboard.canAdminister ? (
              <form action={queueBackgroundJob} className="flex flex-wrap gap-2">
                <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" name="type">
                  {workerTasks.map((task) => (
                    <option key={task.type} value={task.type}>
                      {formatLabel(task.type)}
                    </option>
                  ))}
                </select>
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Queue job</button>
              </form>
            ) : null}
          </div>
          {dashboard.jobs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No jobs have been recorded for this workspace.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {dashboard.jobs.map((job) => (
                <div className="rounded-lg bg-white/5 p-3" key={job.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{formatLabel(job.type)}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {job.status} · {job.progress}% · {job.attempts} attempts
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">{formatDate(job.updatedAt)}</p>
                  </div>
                  {job.error ? <p className="mt-2 text-sm text-red-300">{job.error}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">Feature flags</h2>
          {dashboard.featureFlags.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No feature flags have been configured.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {dashboard.featureFlags.map((flag) => (
                <div className="flex items-start justify-between gap-4 rounded-lg bg-white/5 p-3" key={flag.key}>
                  <div>
                    <h3 className="font-semibold">{formatLabel(flag.key)}</h3>
                    <p className="mt-1 text-sm text-slate-400">{flag.description ?? 'No description saved.'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={flag.enabled ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-slate-500'}>
                      {flag.enabled ? 'Enabled' : 'Off'}
                    </span>
                    {dashboard.canAdminister ? (
                      <form action={toggleFeatureFlag}>
                        <input name="key" type="hidden" value={flag.key} />
                        <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
                          {flag.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-semibold">Audit activity</h2>
        {dashboard.auditLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No audit events have been recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">When</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.auditLogs.map((log) => (
                  <tr className="border-t border-white/10" key={log.id}>
                    <td className="py-3 pr-4">{formatLabel(log.action)}</td>
                    <td className="pr-4">
                      {log.targetType}
                      {log.targetId ? `:${log.targetId.slice(0, 8)}` : ''}
                    </td>
                    <td>{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
