'use client';

import { useActionState } from 'react';
import { changeCurrentPassword } from '@/app/(app)/settings/actions';
import { initialAuthActionState } from '@/app/(auth)/auth-state';

export function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changeCurrentPassword, initialAuthActionState);
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" name="currentPassword" placeholder="Current password" required type="password" />
      <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" minLength={8} name="newPassword" placeholder="New password" required type="password" />
      <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" minLength={8} name="confirmation" placeholder="Confirm new password" required type="password" />
      <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60" disabled={pending}>
        {pending ? 'Changing...' : 'Change password'}
      </button>
      {state.message ? <p className={`rounded-lg px-3 py-2 text-xs ${state.ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{state.message}</p> : null}
    </form>
  );
}
