import Link from 'next/link';
import { ArrowRightLeft } from 'lucide-react';
import { LogoutButton } from './logout-button';
import { MobileNavigation } from './mobile-navigation';
import { switchWorkspace } from '@/app/(app)/workspace-actions';
import type { WorkspaceNavigation } from '@/lib/server/workspace-context';

const nav = ['Overview', 'Opportunities', 'Discovery', 'Domain Generator', 'Expired Domains', 'Auctions', 'Watchlists', 'Buyer Research', 'Portfolio', 'Renewals', 'Outreach', 'Analytics', 'Reports', 'Notifications', 'Integrations', 'Operations', 'Settings', 'Admin'];

export function AppShell({ children, workspaceNavigation }: { children: React.ReactNode; workspaceNavigation: WorkspaceNavigation }) {
  const current = workspaceNavigation.workspaces.find((workspace) => workspace.id === workspaceNavigation.currentWorkspaceId);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[280px_1fr]">
      <MobileNavigation items={nav} workspaceNavigation={workspaceNavigation} />
      <aside className="hidden min-h-screen flex-col border-r border-white/10 bg-slate-950/80 p-5 md:flex">
        <Link href="/" className="text-xl font-bold">DomainScout AI</Link>
        <div className="mt-6 border-y border-white/10 py-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Workspace</p>
          {workspaceNavigation.workspaces.length > 1 ? (
            <form action={switchWorkspace} className="mt-2 flex items-center gap-2">
              <select
                aria-label="Current workspace"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm"
                defaultValue={workspaceNavigation.currentWorkspaceId}
                name="workspaceId"
              >
                {workspaceNavigation.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
              <button
                aria-label="Switch workspace"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/10"
                title="Switch workspace"
              >
                <ArrowRightLeft size={16} />
              </button>
            </form>
          ) : (
            <p className="mt-2 truncate text-sm font-semibold">{current?.name ?? 'Workspace'}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">{current?.role ?? 'MEMBER'}</p>
        </div>
        <nav aria-label="Primary navigation" className="mt-6 grid gap-2">
          {nav.map((name) => (
            <Link key={name} className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10" href={`/${name.toLowerCase().replaceAll(' ', '-')}`}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-6"><LogoutButton /></div>
      </aside>
      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}
