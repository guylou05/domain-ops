'use client';

import { useActionState } from 'react';
import { completeMfaSignIn } from './actions';
import { initialAuthActionState } from '@/app/(auth)/auth-state';

export function MfaChallengeForm() {
  const [state, action, pending] = useActionState(completeMfaSignIn, initialAuthActionState);
  return (
    <form action={action} className="mt-6 grid gap-4">
      <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" autoComplete="one-time-code" name="code" placeholder="Authenticator or recovery code" required />
      <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={pending}>
        {pending ? 'Verifying...' : 'Verify and continue'}
      </button>
      {state.message ? <p className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{state.message}</p> : null}
    </form>
  );
}
