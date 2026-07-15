'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { switchWorkspace } from '@/app/(app)/workspace-actions';
import type { WorkspaceNavigation } from '@/lib/server/workspace-context';
import { LogoutButton } from './logout-button';

export function MobileNavigation({ items, workspaceNavigation }: { items: string[]; workspaceNavigation: WorkspaceNavigation }) {
  const [open, setOpen] = useState(false);
  const current = workspaceNavigation.workspaces.find((workspace) => workspace.id === workspaceNavigation.currentWorkspaceId);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950 md:hidden">
      <div className="flex h-16 items-center justify-between px-4">
        <Link className="font-bold" href="/overview">DomainScout AI</Link>
        <button
          aria-controls="mobile-navigation-panel"
          aria-expanded={open}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          className="grid size-10 place-items-center rounded-lg border border-white/10 text-slate-200"
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          type="button"
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
      {open ? (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 p-4" id="mobile-navigation-panel">
          <div className="border-b border-white/10 pb-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Workspace</p>
            {workspaceNavigation.workspaces.length > 1 ? (
              <form action={switchWorkspace} className="mt-2 flex gap-2">
                <select aria-label="Current workspace" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm" defaultValue={workspaceNavigation.currentWorkspaceId} name="workspaceId">
                  {workspaceNavigation.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </select>
                <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold" type="submit">Switch</button>
              </form>
            ) : <p className="mt-2 truncate text-sm font-semibold">{current?.name ?? 'Workspace'}</p>}
            <p className="mt-1 text-xs text-slate-500">{current?.role ?? 'MEMBER'}</p>
          </div>
          <nav aria-label="Mobile navigation" className="grid grid-cols-2 gap-2 py-4">
            {items.map((name) => (
              <Link key={name} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10" href={`/${name.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setOpen(false)}>{name}</Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
      ) : null}
    </header>
  );
}
