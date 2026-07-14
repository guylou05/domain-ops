'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { registerWorkspaceUser, requestPasswordReset } from './auth-actions';
import { initialAuthActionState } from './auth-state';
import { credentialSignIn } from '@/lib/client/credential-sign-in';

function ActionMessage({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{message}</p>;
}

export function RegisterForm({ plans, selectedPlan }: { plans: string[]; selectedPlan: string }) {
  const [state, setState] = useState(initialAuthActionState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      const registration = await registerWorkspaceUser(initialAuthActionState, formData);
      setState(registration);
      if (!registration.ok) return;

      const signIn = await credentialSignIn(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''));
      if (signIn.ok) {
        window.location.href = signIn.url;
        return;
      }
      setState({ ok: false, message: `Account created, but automatic sign-in failed. ${signIn.message}` });
    } catch {
      setState({ ok: false, message: 'The account could not be created. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="card grid gap-4" onSubmit={handleSubmit}>
      <div>
        <h1 className="text-3xl font-bold">Register</h1>
        <p className="mt-3 text-slate-300">Create your workspace with a 14-day trial. No payment details are required.</p>
      </div>
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="name" placeholder="Name" />
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="email" placeholder="email@example.com" type="email" required />
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="password" placeholder="Password" type="password" minLength={8} required />
      <label className="grid gap-2 text-sm text-slate-300">
        Plan
        <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" defaultValue={selectedPlan} name="planName">
          {plans.map((plan) => (
            <option key={plan} value={plan}>{plan}</option>
          ))}
        </select>
      </label>
      <button className="rounded-xl bg-brand px-4 py-2 font-semibold disabled:opacity-60" disabled={pending}>
        {pending ? 'Creating workspace...' : 'Start trial'}
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
