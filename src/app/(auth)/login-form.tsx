'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { initialAuthActionState } from './auth-state';
import { credentialSignIn } from '@/lib/client/credential-sign-in';

function ActionMessage({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{message}</p>;
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, setState] = useState(initialAuthActionState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await credentialSignIn(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''));
      if (result.ok) {
        window.location.href = result.url;
        return;
      }
      setState({ ok: false, message: result.message });
    } catch {
      setState({ ok: false, message: 'Sign-in failed. Check the deployment logs for the auth error.' });
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setPending(true);
    await signIn('google', { callbackUrl: '/overview' });
    setPending(false);
  }

  return (
    <form className="card grid gap-4" onSubmit={handleSubmit}>
      <div>
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="mt-3 text-slate-300">Sign in with stored credentials to start a workspace session.</p>
      </div>
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="email" placeholder="email@example.com" type="email" required />
      <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="password" placeholder="Password" type="password" required />
      <button className="rounded-xl bg-brand px-4 py-2 font-semibold disabled:opacity-60" disabled={pending}>
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
      {googleEnabled ? (
        <button
          className="rounded-xl border border-white/10 px-4 py-2 font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
          disabled={pending}
          onClick={handleGoogleSignIn}
          type="button"
        >
          Continue with Google
        </button>
      ) : null}
      <ActionMessage ok={state.ok} message={state.message} />
    </form>
  );
}
