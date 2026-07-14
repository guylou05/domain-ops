import { updateRuntimeSettings, updateWorkspaceName } from './actions';
import { getSettingsView } from '@/lib/server/settings';

export const dynamic = 'force-dynamic';

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function formatLabel(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default async function SettingsPage() {
  const settings = await getSettingsView();

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Workspace configuration, membership, plan entitlements, and feature readiness.
        </p>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="text-xl font-semibold">Workspace</h2>
          <form action={updateWorkspaceName} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              defaultValue={settings.workspace.name}
              name="name"
              required
            />
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Save name</button>
          </form>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Name</dt>
              <dd className="mt-1 font-medium">{settings.workspace.name}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Slug</dt>
              <dd className="mt-1 font-medium">{settings.workspace.slug}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className="mt-1 font-medium">{settings.workspace.status}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Updated</dt>
              <dd className="mt-1 font-medium">{formatDate(settings.workspace.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">Current user</h2>
          <p className="mt-4 font-medium">{settings.currentUser.name ?? settings.currentUser.email}</p>
          <p className="mt-1 text-sm text-slate-400">{settings.currentUser.email}</p>
          <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300">Role: {settings.currentUser.role}</p>
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-semibold">Runtime settings</h2>
        <form action={updateRuntimeSettings} className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="text-slate-300">Availability provider</span>
            <select
              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              defaultValue={settings.appConfig.availabilityProvider}
              name="availabilityProvider"
            >
              <option value="mock">Mock</option>
              <option value="deterministic">Deterministic</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-300">Worker job limit</span>
            <input
              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              defaultValue={settings.appConfig.workerJobLimit}
              min={1}
              max={50}
              name="workerJobLimit"
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-300">Worker lease seconds</span>
            <input
              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              defaultValue={settings.appConfig.workerLeaseMs / 1000}
              min={10}
              max={3600}
              name="workerLeaseSeconds"
              type="number"
            />
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <input defaultChecked={settings.appConfig.authDiagnosticsEnabled} name="authDiagnosticsEnabled" type="checkbox" />
            <span>Enable auth diagnostics endpoint</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <input defaultChecked={settings.appConfig.schedulerEnabled} name="schedulerEnabled" type="checkbox" />
            <span>Enable recurring background jobs</span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-slate-300">Scheduler poll seconds</span>
            <input
              className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
              defaultValue={settings.appConfig.schedulerPollMs / 1000}
              min={10}
              max={600}
              name="schedulerPollSeconds"
              type="number"
            />
          </label>
          <fieldset className="grid gap-3 border-t border-white/10 pt-4 lg:col-span-2">
            <legend className="pr-3 text-sm font-semibold text-slate-200">Recurring task cadence</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  key: 'dailyOpportunityDigest',
                  label: 'Opportunity digest',
                  schedule: settings.appConfig.jobSchedules.dailyOpportunityDigest,
                },
                {
                  key: 'buyerResearchRefresh',
                  label: 'Buyer research refresh',
                  schedule: settings.appConfig.jobSchedules.buyerResearchRefresh,
                },
                {
                  key: 'portfolioSnapshot',
                  label: 'Portfolio snapshot',
                  schedule: settings.appConfig.jobSchedules.portfolioSnapshot,
                },
              ].map((task) => (
                <div className="grid gap-3 rounded-lg border border-white/10 p-3" key={task.key}>
                  <label className="flex items-center gap-3 text-sm">
                    <input defaultChecked={task.schedule.enabled} name={`${task.key}Enabled`} type="checkbox" />
                    <span>{task.label}</span>
                  </label>
                  <label className="grid gap-2 text-xs text-slate-400">
                    Interval in minutes
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                      defaultValue={task.schedule.intervalMinutes}
                      min={5}
                      max={10080}
                      name={`${task.key}IntervalMinutes`}
                      type="number"
                    />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="lg:col-span-2">
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Save runtime settings</button>
          </div>
        </form>
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-semibold">Members</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {settings.members.map((member) => (
                <tr className="border-t border-white/10" key={member.email}>
                  <td className="py-3 pr-4">{member.name ?? 'Unnamed'}</td>
                  <td className="pr-4">{member.email}</td>
                  <td className="pr-4">{member.role}</td>
                  <td>{formatDate(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-semibold">Plan</h2>
          {settings.subscriptions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No subscription record is attached to this workspace.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {settings.subscriptions.map((subscription) => (
                <div className="rounded-lg bg-white/5 p-4" key={`${subscription.plan.name}-${subscription.status}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{subscription.plan.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{formatCurrency(subscription.plan.priceCents)}/mo · {subscription.status}</p>
                    </div>
                    <p className="text-sm text-slate-500">{subscription.trialEndsAt ? `Trial ends ${formatDate(subscription.trialEndsAt)}` : 'No trial'}</p>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    {subscription.plan.entitlements.map((entitlement) => (
                      <div className="flex justify-between rounded-lg border border-white/10 px-3 py-2" key={entitlement.key}>
                        <span>{formatLabel(entitlement.key)}</span>
                        <span>{entitlement.enabled ? entitlement.limit ?? 'Enabled' : 'Off'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">Feature readiness</h2>
          <div className="mt-4 space-y-3">
            {settings.featureFlags.map((flag) => (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-white/5 p-3" key={flag.key}>
                <div>
                  <h3 className="font-semibold">{formatLabel(flag.key)}</h3>
                  <p className="mt-1 text-sm text-slate-400">{flag.description ?? 'No description saved.'}</p>
                </div>
                <span className={flag.enabled ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-slate-500'}>
                  {flag.enabled ? 'On' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
