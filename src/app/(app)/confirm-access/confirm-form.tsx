'use client';

import { useActionState } from 'react';
import { confirmSensitiveAccess } from './actions';
import { initialAuthActionState } from '@/app/(auth)/auth-state';

export function ConfirmAccessForm({ mfaEnabled, returnTo }: { mfaEnabled: boolean; returnTo: string }) {
  const [state, action, pending] = useActionState(confirmSensitiveAccess, initialAuthActionState);
  return (
    <form action={action} className="mt-6 grid max-w-md gap-4">
      <input name="returnTo" type="hidden" value={returnTo} />
      {mfaEnabled ? (
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" autoComplete="one-time-code" name="code" placeholder="Authenticator or recovery code" required />
      ) : (
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" autoComplete="current-password" name="password" placeholder="Current password" required type="password" />
      )}
      <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending}>
        {pending ? 'Confirming...' : 'Confirm access'}
      </button>
      {state.message ? <p className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{state.message}</p> : null}
    </form>
  );
}
