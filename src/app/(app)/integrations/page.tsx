import Link from 'next/link';
import { removeProviderCredential, saveProviderCredential, toggleIntegrationStatus } from './actions';
import { getIntegrations, getProviderCredentialViews, getProviderRuntimeStatuses } from '@/lib/server/integrations';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null): string {
  if (!value) return 'No credential';
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function IntegrationsPage() {
  const [integrations, providerStatuses, credentialVault] = await Promise.all([
    getIntegrations(),
    getProviderRuntimeStatuses(),
    getProviderCredentialViews(),
  ]);
  const configuredCount = credentialVault.providers.filter((provider) => provider.source !== 'missing').length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Provider readiness for research, reporting, and account recovery automation.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
          {configuredCount}/{credentialVault.providers.length} live credentials
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {providerStatuses.map((provider) => (
          <div className="border-l-2 border-white/10 pl-3" key={provider.key}>
            <h2 className="font-semibold">{provider.label}</h2>
            <p className="mt-1 text-sm text-slate-400">Mode: {provider.mode}</p>
            <p className={provider.liveReady ? 'mt-2 text-xs font-semibold text-emerald-300' : 'mt-2 text-xs font-semibold text-amber-200'}>
              {provider.liveReady ? 'Ready' : 'Endpoint or API key missing'}
            </p>
          </div>
        ))}
      </section>

      <section className="card mt-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-xl font-semibold">Credential vault</h2>
            <p className="mt-1 text-sm text-slate-400">Stored keys are encrypted and never displayed after saving.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">{credentialVault.canManage ? 'Admin access' : 'Read only'}</span>
        </div>
        <div className="mt-5 divide-y divide-white/10">
          {credentialVault.providers.map((provider) => (
            <div className="grid gap-3 py-4 lg:grid-cols-[220px_1fr_auto] lg:items-end" key={provider.key}>
              <div>
                <h3 className="font-semibold">{provider.label}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {provider.source === 'database' ? `Stored ${formatDate(provider.updatedAt)}` : provider.source === 'environment' ? 'Using Railway variable' : 'No key configured'}
                </p>
              </div>
              <form action={saveProviderCredential} className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input name="provider" type="hidden" value={provider.key} />
                <input
                  aria-label={`${provider.label} API key`}
                  autoComplete="new-password"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm disabled:opacity-50"
                  disabled={!credentialVault.canManage}
                  name="secret"
                  placeholder="Enter a new API key"
                  required
                  type="password"
                />
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!credentialVault.canManage}>Save</button>
              </form>
              <form action={removeProviderCredential}>
                <input name="provider" type="hidden" value={provider.key} />
                <button className="w-full rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-50" disabled={!credentialVault.canManage || provider.source !== 'database'}>Remove</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {integrations.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No integrations configured</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or add provider records when live integrations are enabled.
          </p>
          <Link className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/admin">
            Open admin
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {integrations.map((integration) => (
            <article className="card" key={integration.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{integration.provider}</h2>
                  <p className="mt-2 text-sm text-slate-400">{integration.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={integration.configured ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-slate-500'}>
                    {integration.configured ? 'Configured' : 'Missing key'}
                  </span>
                  <form action={toggleIntegrationStatus}>
                    <input name="integrationId" type="hidden" value={integration.id} />
                    <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
                      {integration.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <dt className="text-slate-400">Status</dt>
                <dd className="text-right">{integration.status}</dd>
                <dt className="text-slate-400">Mode</dt>
                <dd className="text-right">{integration.mode}</dd>
                <dt className="text-slate-400">Credential</dt>
                <dd className="text-right">{formatDate(integration.credentialCreatedAt)}</dd>
                <dt className="text-slate-400">Feature flag</dt>
                <dd className="text-right">
                  {integration.featureFlag ? (
                    <span className={integration.featureFlag.enabled ? 'text-emerald-300' : 'text-slate-500'}>
                      {integration.featureFlag.key}: {integration.featureFlag.enabled ? 'on' : 'off'}
                    </span>
                  ) : (
                    'None'
                  )}
                </dd>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
