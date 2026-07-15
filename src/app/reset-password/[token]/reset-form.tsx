'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { resetPassword } from './actions';
import { initialAuthActionState } from '@/app/(auth)/auth-state';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initialAuthActionState);
  return (
    <form action={action} className="mt-6 grid gap-4">
      <input name="token" type="hidden" value={token} />
      <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" minLength={8} name="password" placeholder="New password" required type="password" />
      <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" minLength={8} name="confirmation" placeholder="Confirm new password" required type="password" />
      <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending}>
        {pending ? 'Updating...' : 'Update password'}
      </button>
      {state.message ? <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{state.message}</p> : null}
      {state.ok ? <Link className="text-center text-sm font-semibold text-brand" href="/login">Continue to login</Link> : null}
    </form>
  );
}
