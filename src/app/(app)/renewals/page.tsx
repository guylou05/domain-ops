import Link from 'next/link';
import { getRenewalCalendar } from '@/lib/server/deal-lifecycle';

export const dynamic = 'force-dynamic';
const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export default async function RenewalsPage() {
  const renewals = await getRenewalCalendar();
  return <div><h1 className="text-3xl font-bold">Renewal calendar</h1><p className="mt-2 text-sm text-slate-400">Carrying costs, recommendations, and recorded keep, review, or drop decisions.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-3">{[['Upcoming domains',String(renewals.length)],['Annual exposure',currency(renewals.reduce((sum,item)=>sum+item.cost,0))],['Needs decision',String(renewals.filter(item=>!item.latestDecision).length)]].map(([label,value])=><div className="card" key={label}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
    <div className="card mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-400"><tr><th className="pb-3">Domain</th><th>Due</th><th>Days</th><th>Cost</th><th>Value / cost</th><th>Recommendation</th><th>Decision</th></tr></thead><tbody>{renewals.map((item)=><tr className="border-t border-white/10" key={item.id}><td className="py-4"><Link className="font-semibold text-brand" href={`/portfolio/${item.id}`}>{item.domain}</Link></td><td>{item.dueDate.toLocaleDateString()}</td><td className={item.daysUntilDue<=30?'text-amber-300':''}>{item.daysUntilDue}</td><td>{currency(item.cost)}</td><td>{(item.valuation/Math.max(item.cost,1)).toFixed(1)}x</td><td>{item.recommendation}</td><td>{item.latestDecision ?? 'Pending'}</td></tr>)}</tbody></table>{!renewals.length&&<p className="py-8 text-center text-slate-400">No active holdings need renewal tracking.</p>}</div>
  </div>;
}
