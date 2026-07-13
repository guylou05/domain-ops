'use client';

import { useActionState } from 'react';
import { generateDomainOpportunities, importDomainOpportunities, initialActionState } from './actions';

function ResultSummary({ message, ok }: { message: string; ok: boolean }) {
  if (!message) return null;
  return <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>{message}</p>;
}

export function GenerateDomainsForm() {
  const [state, action, pending] = useActionState(generateDomainOpportunities, initialActionState);
  return <form action={action} className="card grid gap-4"><div><h2 className="text-xl font-semibold">Generate and save opportunities</h2><p className="mt-1 text-sm text-slate-400">Creates ideas, runs mock availability, scores them, and persists Phase 1 opportunity records.</p></div><div className="grid gap-3 md:grid-cols-2"><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="concept" placeholder="Business concept, e.g. workflow automation" required /><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="industry" placeholder="Industry, e.g. SaaS" required /><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="keywords" placeholder="Keywords: agent, revenue, ops" required /><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="location" placeholder="Optional location" /><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="tlds" defaultValue=".com,.ai,.io" /><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="count" type="number" min="1" max="50" defaultValue="20" /><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="maxLength" type="number" min="6" max="30" defaultValue="18" /></div><button className="rounded-xl bg-brand px-4 py-2 font-semibold disabled:opacity-60" disabled={pending}>{pending ? 'Generating…' : 'Generate, analyze, and save'}</button><ResultSummary message={state.message} ok={state.ok} /></form>;
}

export function ImportDomainsForm() {
  const [state, action, pending] = useActionState(importDomainOpportunities, initialActionState);
  return <form action={action} className="card grid gap-4"><div><h2 className="text-xl font-semibold">Manual / CSV import</h2><p className="mt-1 text-sm text-slate-400">Paste domains separated by commas, spaces, tabs, or new lines. Invalid rows are ignored before scoring.</p></div><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="industry" defaultValue="general" /><textarea className="min-h-36 rounded-xl border border-white/10 bg-slate-950 px-3 py-2" name="domains" placeholder="exampleai.com, workflowpilot.ai&#10;localroofpros.com" required /><button className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-950 disabled:opacity-60" disabled={pending}>{pending ? 'Importing…' : 'Import, analyze, and save'}</button><ResultSummary message={state.message} ok={state.ok} /></form>;
}
