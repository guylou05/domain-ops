const sections = [
  {
    title: 'Data We Process',
    body: 'DomainScout AI stores account details, workspace membership, saved domains, generated research, watchlists, portfolio records, reports, notifications, integrations, audit events, and usage records needed to operate the product.',
  },
  {
    title: 'How We Use Data',
    body: 'We use workspace data to run domain availability checks, scoring, valuation estimates, buyer research workflows, portfolio views, reports, security reviews, support, and product operations.',
  },
  {
    title: 'Security Controls',
    body: 'The application is designed around workspace-scoped access, role checks, hashed passwords, session controls, audit logs, and encrypted credential records for provider integrations.',
  },
  {
    title: 'Provider Data',
    body: 'Development environments use mock providers. Live registrar, marketplace, AI, and buyer research providers should be enabled only after secrets, rate limits, retention rules, and user notices are configured.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <section className="py-16">
        <p className="text-sm font-semibold text-brand">Privacy</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Privacy practices for workspace domain research.</h1>
        <p className="mt-5 max-w-2xl text-slate-300">
          This policy describes the product data model and operational intent for DomainScout AI. It should be reviewed by counsel before production launch.
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
