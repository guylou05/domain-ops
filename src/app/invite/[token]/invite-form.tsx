'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { acceptWorkspaceInvitation } from './actions';
import { initialAuthActionState } from '@/app/(auth)/auth-state';

export function InviteAcceptanceForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptWorkspaceInvitation, initialAuthActionState);

  return (
    <form action={action} className="mt-6 grid gap-4">
      <input name="token" type="hidden" value={token} />
      <label className="grid gap-2 text-sm text-slate-300">
        Name
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" name="name" placeholder="Your name" />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Email
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-400" disabled value={email} />
      </label>
      <label className="grid gap-2 text-sm text-slate-300">
        Password
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" minLength={8} name="password" required type="password" />
      </label>
      <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending}>
        {pending ? 'Joining...' : 'Join workspace'}
      </button>
      {state.message ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>
          {state.message}
        </p>
      ) : null}
      {state.ok ? (
        <Link className="text-center text-sm font-semibold text-brand" href="/login">
          Continue to login
        </Link>
      ) : null}
    </form>
  );
}
