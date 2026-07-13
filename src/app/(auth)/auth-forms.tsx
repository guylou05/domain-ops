'use client';

import { useActionState } from 'react';
import { registerWorkspaceUser, requestPasswordReset } from './auth-actions';
import { initialAuthActionState } from './auth-state';

function ActionMessage({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{message}</p>;
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerWorkspaceUser, initialAuthActionState);

  return (
    <form action={action} className="card grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Register</h1>
        <p className="mt-3 text-slate-300">Create a user and private workspace record for local beta testing.</p>
      </div>
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="name" placeholder="Name" />
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="email" placeholder="email@example.com" type="email" required />
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="password" placeholder="Password" type="password" minLength={8} required />
      <button className="rounded-xl bg-brand px-4 py-2 font-semibold disabled:opacity-60" disabled={pending}>
        {pending ? 'Creating...' : 'Create account'}
      </button>
      <ActionMessage ok={state.ok} message={state.message} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialAuthActionState);

  return (
    <form action={action} className="card grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Forgot password</h1>
        <p className="mt-3 text-slate-300">Validate account presence while email delivery is prepared.</p>
      </div>
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="email" placeholder="email@example.com" type="email" required />
      <button className="rounded-xl bg-brand px-4 py-2 font-semibold disabled:opacity-60" disabled={pending}>
        {pending ? 'Checking...' : 'Request reset'}
      </button>
      <ActionMessage ok={state.ok} message={state.message} />
    </form>
  );
}
