import { generateDomainIdeas } from '@/lib/domain-engine';
import { GenerateDomainsForm, ImportDomainsForm } from './forms';

export default function Generator() {
  const ideas = generateDomainIdeas({
    concept: 'automation',
    industry: 'AI',
    keywords: ['agent', 'workflow', 'sales'],
    tlds: ['.com', '.ai'],
    count: 8,
    maxLength: 18,
  });

  return <div className="grid gap-6"><div><p className="text-sm uppercase tracking-[0.3em] text-brand">Phase 1 workflow</p><h1 className="mt-2 text-3xl font-bold">Domain Generator</h1><p className="mt-3 max-w-3xl text-slate-300">Generate ideas, run mock registrar availability, calculate explainable scores, and save opportunities into the workspace database for downstream review.</p></div><div className="grid gap-6 xl:grid-cols-2"><GenerateDomainsForm /><ImportDomainsForm /></div><section className="card"><h2 className="text-xl font-semibold">Example ideas</h2><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{ideas.map((idea) => <div className="rounded-xl border border-white/10 p-3" key={idea}>{idea}</div>)}</div></section></div>;
}
