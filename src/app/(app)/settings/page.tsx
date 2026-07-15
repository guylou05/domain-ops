import { updateRuntimeSettings, updateWorkspaceName } from './actions';
import { getSettingsView } from '@/lib/server/settings';
import { PasswordChangeForm } from '@/components/password-change-form';
import { openBillingPortal, startSubscriptionCheckout } from './billing-actions';
import { resendEmailVerification } from './verification-actions';

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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ billing?: string; billingError?: string; verification?: string; verificationError?: string }>;
}) {
  const feedback = await searchParams;
  const settings = await getSettingsView();
  const canManageRuntime = settings.currentUser.role === 'OWNER' || settings.currentUser.role === 'ADMIN';

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Workspace configuration, membership, plan entitlements, and feature readiness.
        </p>
      </div>

      {feedback?.billing === 'checkout-complete' ? (
        <p className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-200">Checkout completed. Billing status will refresh when the signed webhook is processed.</p>
      ) : null}
      {feedback?.billing === 'checkout-cancelled' ? (
        <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200">Checkout was cancelled. Your current plan remains unchanged.</p>
      ) : null}
      {feedback?.billingError ? (
        <p className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-sm text-rose-200">{feedback.billingError}</p>
      ) : null}
      {feedback?.verification === 'sent' ? (
        <p className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-200">Verification email sent. The link expires in 24 hours.</p>
      ) : null}
      {feedback?.verification === 'already-verified' ? (
        <p className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-200">Your email is already verified.</p>
      ) : null}
      {feedback?.verification === 'not-configured' ? (
        <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200">Transactional email is not configured for this workspace.</p>
      ) : null}
      {feedback?.verification === 'rate-limited' ? (
        <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200">A verification email was sent recently. Try again in one minute.</p>
      ) : null}
      {feedback?.verificationError ? (
        <p className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-sm text-rose-200">{feedback.verificationError}</p>
      ) : null}

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
          <div className="mt-3 rounded-lg border border-white/10 px-3 py-2">
            <p className={settings.currentUser.emailVerified ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-amber-200'}>
              {settings.currentUser.emailVerified ? 'Email verified' : 'Email unverified'}
            </p>
            {!settings.currentUser.emailVerified ? (
              <form action={resendEmailVerification} className="mt-2">
                <button className="text-sm font-semibold text-brand">Send verification email</button>
              </form>
            ) : null}
          </div>
          <PasswordChangeForm />
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="text-xl font-semibold">Runtime settings</h2>
        <form action={updateRuntimeSettings} className="mt-4 grid gap-4 lg:grid-cols-2">
          <fieldset className="contents" disabled={!canManageRuntime}>
          <fieldset className="grid gap-4 border-b border-white/10 pb-5 lg:col-span-2">
            <legend className="pr-3 text-sm font-semibold text-slate-200">Research providers</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: 'Registrar availability', modeName: 'availabilityProvider', endpointName: 'registrarEndpoint', mode: settings.appConfig.availabilityProvider, endpoint: settings.appConfig.providerEndpoints.registrar },
                { label: 'Trademark screening', modeName: 'trademarkProvider', endpointName: 'trademarkEndpoint', mode: settings.appConfig.trademarkProvider, endpoint: settings.appConfig.providerEndpoints.trademark },
                { label: 'Comparable sales', modeName: 'comparableSalesProvider', endpointName: 'comparableSalesEndpoint', mode: settings.appConfig.comparableSalesProvider, endpoint: settings.appConfig.providerEndpoints.comparableSales },
                { label: 'Domain history', modeName: 'historyProvider', endpointName: 'historyEndpoint', mode: settings.appConfig.historyProvider, endpoint: settings.appConfig.providerEndpoints.history },
              ].map((provider) => (
                <div className="grid gap-3 border-l-2 border-white/10 pl-3" key={provider.modeName}>
                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-300">{provider.label}</span>
                    <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={provider.mode} name={provider.modeName}>
                      <option value="mock">Mock</option>
                      <option value="deterministic">Deterministic</option>
                      <option value="live">Live</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs text-slate-400">
                    Live endpoint URL
                    <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" defaultValue={provider.endpoint} name={provider.endpointName} placeholder="https://provider.example/api/check" type="url" />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
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
          <fieldset className="grid gap-4 border-y border-white/10 py-4 lg:col-span-2">
            <legend className="pr-3 text-sm font-semibold text-slate-200">Transactional email</legend>
            <label className="flex items-center gap-3 text-sm">
              <input defaultChecked={settings.appConfig.transactionalEmail.enabled} name="transactionalEmailEnabled" type="checkbox" />
              <span>Enable account security email</span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Sender
                <input
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"
                  defaultValue={settings.appConfig.transactionalEmail.sender}
                  name="transactionalEmailSender"
                  placeholder="DomainScout AI <account@example.com>"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Resend endpoint
                <input
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"
                  defaultValue={settings.appConfig.transactionalEmail.endpoint}
                  name="transactionalEmailEndpoint"
                  type="url"
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="grid gap-4 border-b border-white/10 pb-5 lg:col-span-2">
            <legend className="pr-3 text-sm font-semibold text-slate-200">Subscription billing</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Stripe mode
                <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={settings.appConfig.billing.mode} name="billingMode">
                  <option value="off">Off</option>
                  <option value="test">Test</option>
                  <option value="live">Live</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Billing currency
                <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" defaultValue={settings.appConfig.billing.currency.toUpperCase()} maxLength={3} minLength={3} name="billingCurrency" />
              </label>
            </div>
            <p className="text-xs text-slate-400">Checkout requires the Stripe secret key. Subscription activation also requires the webhook secret in Integrations.</p>
          </fieldset>
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
          </fieldset>
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
                <div className="rounded-lg bg-white/5 p-4" key={subscription.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{subscription.plan.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">Provider: {formatLabel(subscription.provider)}</p>
                      <p className="mt-1 text-sm text-slate-400">{formatCurrency(subscription.plan.priceCents)}/mo · {formatLabel(subscription.status)}</p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {subscription.trialEndsAt
                        ? `Trial ends ${formatDate(subscription.trialEndsAt)}`
                        : subscription.currentPeriodEnd
                          ? `${subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} ${formatDate(subscription.currentPeriodEnd)}`
                          : `Usage resets ${formatDate(settings.monthlyUsage.periodEnd)}`}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    {subscription.plan.entitlements.map((entitlement) => {
                      const usage = settings.monthlyUsage.entitlements.find((item) => item.key === entitlement.key);
                      const used = usage?.used ?? 0;
                      const percent = entitlement.limit ? Math.min(100, Math.round((used / entitlement.limit) * 100)) : 0;
                      return (
                        <div className="rounded-lg border border-white/10 px-3 py-2" key={entitlement.key}>
                          <div className="flex justify-between gap-3">
                            <span>{formatLabel(entitlement.key)}</span>
                            <span>{entitlement.enabled ? `${used} / ${entitlement.limit ?? 'Unlimited'}` : 'Off'}</span>
                          </div>
                          {entitlement.enabled && entitlement.limit ? (
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {canManageRuntime ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      {subscription.externalCustomerId ? (
                        <form action={openBillingPortal}>
                          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Manage billing</button>
                        </form>
                      ) : (
                        <form action={startSubscriptionCheckout}>
                          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!settings.billing.checkoutReady}>Start paid subscription</button>
                        </form>
                      )}
                      <span className={settings.billing.checkoutReady && settings.billing.webhookReady ? 'self-center text-xs font-semibold text-emerald-300' : 'self-center text-xs font-semibold text-amber-200'}>
                        {settings.billing.checkoutReady && settings.billing.webhookReady ? 'Billing ready' : 'Complete billing setup in Runtime settings and Integrations'}
                      </span>
                    </div>
                  ) : null}
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
