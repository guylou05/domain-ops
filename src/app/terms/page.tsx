const sections = [
  {
    title: 'Use Of The Service',
    body: 'DomainScout AI is a domain research and portfolio operations tool. Users are responsible for validating availability, legal risk, pricing, buyer fit, and acquisition decisions before taking action.',
  },
  {
    title: 'No Professional Advice',
    body: 'Scores, valuations, risk labels, reports, and buyer research are informational outputs. They are not legal, financial, trademark, tax, or investment advice.',
  },
  {
    title: 'Workspace Responsibilities',
    body: 'Workspace owners are responsible for member access, imported data, provider credentials, outreach content, compliance with marketplace terms, and retention of business records.',
  },
  {
    title: 'Acceptable Use',
    body: 'Users may not use the service for deceptive outreach, unlawful scraping, infringement, credential abuse, spam, malware, or attempts to bypass provider rate limits and security controls.',
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <section className="py-16">
        <p className="text-sm font-semibold text-brand">Terms</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Terms for responsible domain operations.</h1>
        <p className="mt-5 max-w-2xl text-slate-300">
          These draft terms set expectations for using DomainScout AI during product development. Final production terms should be reviewed by counsel.
        </p>
      </section>

      <section className="grid gap-4">
        {sections.map((section) => (
          <article className="card" key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
