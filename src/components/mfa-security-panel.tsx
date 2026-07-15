'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  confirmMfaEnrollment,
  regenerateRecoveryCodes,
  startMfaEnrollment,
  turnOffMfa,
  type SecurityActionResult,
} from '@/app/(app)/settings/security-actions';

const initialResult: SecurityActionResult = { ok: false, message: '' };

export function MfaSecurityPanel({ mfaEnabled, recoveryCodesRemaining }: { mfaEnabled: boolean; recoveryCodesRemaining: number }) {
  const [result, setResult] = useState(initialResult);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function run(action: () => Promise<SecurityActionResult>) {
    setPending(true);
    try {
      const nextResult = await action();
      setResult(nextResult);
      if (nextResult.ok && !nextResult.setup) router.refresh();
    } catch {
      setResult({ ok: false, message: 'The security change could not be completed.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-slate-400">{mfaEnabled ? `Enabled · ${recoveryCodesRemaining} recovery codes remaining` : 'Not enabled'}</p>
        </div>
        <span className={mfaEnabled ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-amber-200'}>{mfaEnabled ? 'Enabled' : 'Off'}</span>
      </div>

      {!mfaEnabled && !result.setup ? (
        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => {
          event.preventDefault();
          const password = String(new FormData(event.currentTarget).get('password') ?? '');
          void run(() => startMfaEnrollment(password));
        }}>
          <input className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2" name="password" placeholder="Current password" required type="password" />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending}>{pending ? 'Preparing...' : 'Set up authenticator'}</button>
        </form>
      ) : null}

      {result.setup ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-[240px_1fr]">
          <Image alt="Authenticator QR code" className="bg-white" height={240} src={result.setup.qrDataUrl} unoptimized width={240} />
          <div>
            <p className="text-sm text-slate-300">Manual key</p>
            <code className="mt-2 block break-all rounded-lg bg-slate-950 px-3 py-2 text-sm">{result.setup.secret}</code>
            <form className="mt-4 flex flex-col gap-3" onSubmit={(event) => {
              event.preventDefault();
              const code = String(new FormData(event.currentTarget).get('code') ?? '');
              void run(() => confirmMfaEnrollment(code));
            }}>
              <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" autoComplete="one-time-code" inputMode="numeric" name="code" placeholder="6-digit authenticator code" required />
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending}>Enable two-factor authentication</button>
            </form>
          </div>
        </div>
      ) : null}

      {mfaEnabled ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <form className="grid gap-3 border-l-2 border-white/10 pl-3" onSubmit={(event) => {
            event.preventDefault();
            const code = String(new FormData(event.currentTarget).get('code') ?? '');
            void run(() => regenerateRecoveryCodes(code));
          }}>
            <p className="text-sm font-semibold">Replace recovery codes</p>
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" name="code" placeholder="Authenticator or recovery code" required />
            <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={pending}>Generate new codes</button>
          </form>
          <form className="grid gap-3 border-l-2 border-rose-400/30 pl-3" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(() => turnOffMfa(String(data.get('password') ?? ''), String(data.get('code') ?? '')));
          }}>
            <p className="text-sm font-semibold text-rose-200">Disable two-factor authentication</p>
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" name="password" placeholder="Current password" required type="password" />
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" name="code" placeholder="Authenticator or recovery code" required />
            <button className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-60" disabled={pending}>Disable two-factor authentication</button>
          </form>
        </div>
      ) : null}

      {result.recoveryCodes ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-sm font-semibold text-emerald-200">Recovery codes</p>
          <div className="mt-3 grid gap-2 font-mono text-sm sm:grid-cols-2">
            {result.recoveryCodes.map((code) => <code className="rounded-lg bg-slate-950 px-3 py-2" key={code}>{code}</code>)}
          </div>
        </div>
      ) : null}
      {result.message ? <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{result.message}</p> : null}
    </div>
  );
}
