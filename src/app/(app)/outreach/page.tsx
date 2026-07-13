import Link from 'next/link';
import { approveOutreachMessage } from './actions';
import { getOutreachCampaigns } from '@/lib/server/outreach';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null): string {
  if (!value) return 'Not approved';
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function OutreachPage() {
  const campaigns = await getOutreachCampaigns();
  const totalMessages = campaigns.reduce((sum, campaign) => sum + campaign.messageCount, 0);
  const approvedMessages = campaigns.reduce((sum, campaign) => sum + campaign.approvedCount, 0);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Outreach</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Campaign drafts and approval status for buyer outreach workflows.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
          {approvedMessages}/{totalMessages} approved
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No outreach campaigns yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or create campaigns from ready buyer research targets.
          </p>
          <Link className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/buyer-research">
            Open buyer research
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {campaigns.map((campaign) => (
            <section className="card" key={campaign.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xl font-semibold">{campaign.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {campaign.status} · {campaign.messageCount} messages · {campaign.approvedCount} approved
                  </p>
                </div>
                <Link className="text-sm text-brand" href="/buyer-research">
                  Buyer targets
                </Link>
              </div>

              {campaign.messages.length === 0 ? (
                <p className="mt-5 rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
                  No messages are attached to this campaign yet.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {campaign.messages.map((message) => (
                    <article className="rounded-lg border border-white/10 bg-white/5 p-4" key={message.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{message.subject}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {message.status} · {formatDate(message.approvedAt)}
                          </p>
                        </div>
                        {message.approvedAt ? (
                          <span className="text-sm font-semibold text-emerald-300">Approved</span>
                        ) : (
                          <form action={approveOutreachMessage}>
                            <input name="messageId" type="hidden" value={message.id} />
                            <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
                          </form>
                        )}
                      </div>
                      <p className="mt-4 whitespace-pre-line text-sm text-slate-300">{message.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
