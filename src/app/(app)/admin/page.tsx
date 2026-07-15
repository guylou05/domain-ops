import { Mail, Trash2, UserPlus, X } from 'lucide-react';
import {
  createWorkspaceInvitation,
  sendMemberRecoveryEmail,
  queueBackgroundJob,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  toggleFeatureFlag,
  updateWorkspaceMemberRole,
} from './actions';
import { getAdminDashboard } from '@/lib/server/admin';
import { getRegisteredWorkerTasks } from '@/worker/task-registry';
import { InvitationLink } from '@/components/invitation-link';

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

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ invite?: string; recoveryNotice?: string; recoveryError?: string }> }) {
  const feedback = await searchParams;
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

      <section className="card mt-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h2 className="text-xl font-semibold">Team access</h2>
            <p className="mt-1 text-sm text-slate-400">Invite teammates and control their workspace permissions.</p>
          </div>
          {dashboard.canAdminister ? (
            <form action={createWorkspaceInvitation} className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_140px_auto]">
              <input
                className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                name="email"
                placeholder="teammate@example.com"
                required
                type="email"
              />
              <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" name="role" defaultValue="MEMBER">
                {dashboard.role === 'OWNER' ? <option value="ADMIN">Admin</option> : null}
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                <UserPlus size={16} /> Invite
              </button>
            </form>
          ) : null}
        </div>

        {feedback?.invite ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-emerald-200">Invitation created. Share this one-time link:</p>
            <InvitationLink token={feedback.invite} />
          </div>
        ) : null}
        {feedback?.recoveryNotice ? <p className="mt-4 rounded-lg bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{feedback.recoveryNotice}</p> : null}
        {feedback?.recoveryError ? <p className="mt-4 rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{feedback.recoveryError}</p> : null}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-3">Member</th>
                <th className="pb-3">Joined</th>
                <th className="pb-3">Role</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.members.map((member) => {
                const isSelf = member.userId === dashboard.currentUserId;
                const isOwner = member.role === 'OWNER';
                const canManage = dashboard.canAdminister && !isSelf && !isOwner && (dashboard.role === 'OWNER' || member.role !== 'ADMIN');
                return (
                  <tr className="border-t border-white/10" key={member.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{member.name ?? member.email}</p>
                      {member.name ? <p className="text-xs text-slate-500">{member.email}</p> : null}
                      <p className={member.emailVerified ? 'mt-1 text-xs font-semibold text-emerald-300' : 'mt-1 text-xs font-semibold text-amber-200'}>
                        {member.emailVerified ? 'Email verified' : 'Email unverified'}
                      </p>
                    </td>
                    <td className="pr-4 text-slate-400">{formatDate(member.createdAt)}</td>
                    <td className="pr-4">
                      {canManage ? (
                        <form action={updateWorkspaceMemberRole} className="flex items-center gap-2">
                          <input name="membershipId" type="hidden" value={member.id} />
                          <select className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-sm" defaultValue={member.role} name="role">
                            {dashboard.role === 'OWNER' ? <option value="ADMIN">Admin</option> : null}
                            <option value="MEMBER">Member</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Save</button>
                        </form>
                      ) : (
                        <span>{formatLabel(member.role)}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <form action={sendMemberRecoveryEmail}>
                            <input name="membershipId" type="hidden" value={member.id} />
                            <button aria-label={`Send recovery email to ${member.email}`} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-100" title="Send recovery email">
                              <Mail size={16} />
                            </button>
                          </form>
                          <form action={removeWorkspaceMember}>
                            <input name="membershipId" type="hidden" value={member.id} />
                            <button aria-label={`Remove ${member.email}`} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-400/10 hover:text-rose-200" title="Remove member">
                              <Trash2 size={16} />
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {dashboard.invitations.length > 0 ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="font-semibold">Pending invitations</h3>
            <div className="mt-3 grid gap-2">
              {dashboard.invitations.map((invitation) => (
                <div className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2" key={invitation.id}>
                  <div>
                    <p className="text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-slate-500">
                      {formatLabel(invitation.role)} · expires {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  {dashboard.canAdminister ? (
                    <form action={revokeWorkspaceInvitation}>
                      <input name="id" type="hidden" value={invitation.id} />
                      <button
                        aria-label={`Revoke invitation for ${invitation.email}`}
                        className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-100"
                        title="Revoke invitation"
                      >
                        <X size={16} />
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

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
                        {job.status} - {job.progress}% - {job.attempts} attempts
                      </p>
                      {job.lockedBy && job.lockExpiresAt ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Locked by {job.lockedBy} until {formatDate(job.lockExpiresAt)}
                        </p>
                      ) : null}
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
