import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('demo-password', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@domainscout.demo' },
    update: {},
    create: { email: 'admin@domainscout.demo', name: 'Demo Admin', passwordHash, role: Role.ADMIN },
  });

  const user = await prisma.user.upsert({
    where: { email: 'investor@domainscout.demo' },
    update: {},
    create: { email: 'investor@domainscout.demo', name: 'Demo Investor', passwordHash, role: Role.OWNER },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-domain-portfolio' },
    update: {},
    create: {
      name: 'Demo Domain Portfolio',
      slug: 'demo-domain-portfolio',
      members: {
        create: [
          { userId: admin.id, role: Role.ADMIN },
          { userId: user.id, role: Role.OWNER },
        ],
      },
    },
  });

  await prisma.plan.upsert({
    where: { name: 'Professional' },
    update: {},
    create: {
      name: 'Professional',
      priceCents: 9900,
      entitlements: {
        create: [
          { key: 'domain_checks', limit: 5000 },
          { key: 'buyer_research', enabled: true },
        ],
      },
    },
  });

  const names = ['aiautomationhub.com', 'workflowpilot.ai', 'revenueforge.com', 'agentloop.io', 'saassignal.com', 'austinpros.com'];
  const domains = [];

  for (const [index, name] of names.entries()) {
    const domain = await prisma.domain.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name } },
      update: {},
      create: {
        workspaceId: workspace.id,
        createdById: user.id,
        name,
        tld: name.slice(name.lastIndexOf('.')),
        source: 'DEMONSTRATION_SEED',
      },
    });

    domains.push(domain);

    const hasCheck = await prisma.domainCheck.findFirst({ where: { domainId: domain.id } });
    if (!hasCheck) {
      await prisma.domainCheck.create({
        data: {
          domainId: domain.id,
          available: index % 4 !== 0,
          registrationPrice: 12 + index * 4,
          renewalPrice: 15 + index,
          premium: index === 1,
          registrar: 'MockRegistrar',
          status: 'FRESH',
        },
      });
    }

    await prisma.domainOpportunity.upsert({
      where: { domainId: domain.id },
      update: {},
      create: {
        workspaceId: workspace.id,
        domainId: domain.id,
        score: 72 + index * 3,
        riskLevel: index === 0 ? 'MODERATE' : 'LOW',
        estimatedRetailMin: 1800 + index * 300,
        estimatedRetailMax: 6500 + index * 900,
        buyerCount: 8 + index,
        status: 'ACTIVE',
        notes: 'Demonstration data only.',
      },
    });
  }

  let watchlist = await prisma.watchlist.findFirst({
    where: { workspaceId: workspace.id, name: 'AI domains under $50' },
  });

  watchlist ??= await prisma.watchlist.create({
    data: {
      workspaceId: workspace.id,
      name: 'AI domains under $50',
      notes: 'Demonstration watchlist for Phase 2 database-backed views.',
    },
  });

  for (const domain of domains.slice(0, 4)) {
    await prisma.watchlistItem.upsert({
      where: { watchlistId_domainId: { watchlistId: watchlist.id, domainId: domain.id } },
      update: {},
      create: {
        watchlistId: watchlist.id,
        domainId: domain.id,
        notes: 'Monitor pricing and buyer fit before outreach.',
        tags: ['ai', 'shortlist'],
      },
    });
  }

  for (const [index, domain] of domains.slice(1, 4).entries()) {
    const existingHolding = await prisma.portfolioItem.findFirst({
      where: { workspaceId: workspace.id, domainId: domain.id },
    });

    if (!existingHolding) {
      await prisma.portfolioItem.create({
        data: {
          workspaceId: workspace.id,
          domainId: domain.id,
          registrar: 'MockRegistrar',
          purchaseDate: new Date(Date.UTC(2026, index, 15)),
          purchaseCost: 28 + index * 42,
          renewalCost: 18 + index * 3,
          expirationDate: new Date(Date.UTC(2027, index + 3, 15)),
          autoRenew: index !== 2,
          currentValuation: 2400 + index * 850,
          buyNowPrice: 4200 + index * 1200,
          status: 'ACTIVE',
        },
      });
    }
  }

  const hasDigestJob = await prisma.backgroundJob.findFirst({
    where: { workspaceId: workspace.id, type: 'daily_opportunity_digest' },
  });

  if (!hasDigestJob) {
    await prisma.backgroundJob.create({
      data: { workspaceId: workspace.id, type: 'daily_opportunity_digest', status: 'COMPLETED', progress: 100, payload: { demo: true } },
    });
  }

  const hasBuyerResearchJob = await prisma.backgroundJob.findFirst({
    where: { workspaceId: workspace.id, type: 'buyer_research_refresh' },
  });

  if (!hasBuyerResearchJob) {
    await prisma.backgroundJob.create({
      data: {
        workspaceId: workspace.id,
        type: 'buyer_research_refresh',
        status: 'QUEUED',
        progress: 0,
        payload: { demo: true, source: 'seed' },
      },
    });
  }

  const reportSeeds = [
    {
      type: 'PORTFOLIO_REVIEW',
      title: 'Demo portfolio review',
      payload: {
        summary: 'Snapshot of active holdings, renewal exposure, and resale targets for the demo workspace.',
        metrics: [
          { label: 'Holdings', value: '3' },
          { label: 'Renewal exposure', value: '$63' },
          { label: 'Current valuation', value: '$9,750' },
          { label: 'Auto-renew enabled', value: '2 domains' },
        ],
        highlights: [
          'workflowpilot.ai has the strongest blend of score, buyer fit, and resale target.',
          'agentloop.io should be reviewed before renewal because auto-renew is disabled.',
        ],
      },
    },
    {
      type: 'OPPORTUNITY_PIPELINE',
      title: 'AI opportunity pipeline',
      payload: {
        summary: 'Ranked shortlist of seeded AI and automation domains prepared for buyer research.',
        metrics: [
          { label: 'Qualified opportunities', value: '6' },
          { label: 'Average score', value: '80' },
          { label: 'Watchlisted', value: '4' },
          { label: 'Risk mix', value: '5 low / 1 moderate' },
        ],
        highlights: [
          'Prioritize short .com and .ai names before speculative alternatives.',
          'Use buyer research before outreach to avoid low-fit campaigns.',
        ],
      },
    },
  ];

  for (const report of reportSeeds) {
    const existingReport = await prisma.report.findFirst({
      where: { workspaceId: workspace.id, title: report.title },
    });

    if (!existingReport) {
      await prisma.report.create({
        data: {
          workspaceId: workspace.id,
          type: report.type,
          title: report.title,
          payload: report.payload,
        },
      });
    }
  }

  const notificationSeeds = [
    {
      title: 'Opportunity pipeline refreshed',
      body: 'Six demo opportunities are ranked and ready for review in the persisted dashboard.',
      readAt: null,
    },
    {
      title: 'Portfolio review available',
      body: 'The demo portfolio report includes renewal exposure, valuation, and follow-up highlights.',
      readAt: new Date(Date.UTC(2026, 6, 12, 14, 30)),
    },
    {
      title: 'Renewal follow-up recommended',
      body: 'agentloop.io is set to manual renewal and should be reviewed before expiration.',
      readAt: null,
    },
  ];

  for (const notification of notificationSeeds) {
    const existingNotification = await prisma.notification.findFirst({
      where: { workspaceId: workspace.id, userId: user.id, title: notification.title },
    });

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          title: notification.title,
          body: notification.body,
          readAt: notification.readAt,
        },
      });
    }
  }

  const featureFlagSeeds = [
    { key: 'live_registrar_provider', enabled: false, description: 'Use live registrar pricing and availability providers.' },
    { key: 'buyer_research_jobs', enabled: true, description: 'Enable queued buyer research enrichment workflows.' },
    { key: 'ai_report_generation', enabled: false, description: 'Generate reports with AI-assisted summaries.' },
  ];

  for (const flag of featureFlagSeeds) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { enabled: flag.enabled, description: flag.description },
      create: flag,
    });
  }

  const auditSeeds = [
    { action: 'seed.workspace_ready', targetType: 'Workspace', targetId: workspace.id, actorId: user.id },
    { action: 'seed.opportunities_created', targetType: 'DomainOpportunity', targetId: null, actorId: user.id },
    { action: 'seed.reports_created', targetType: 'Report', targetId: null, actorId: admin.id },
  ];

  for (const audit of auditSeeds) {
    const existingAudit = await prisma.auditLog.findFirst({
      where: {
        workspaceId: workspace.id,
        action: audit.action,
        targetType: audit.targetType,
      },
    });

    if (!existingAudit) {
      await prisma.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: audit.actorId,
          action: audit.action,
          targetType: audit.targetType,
          targetId: audit.targetId,
          metadata: { demo: true },
        },
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
