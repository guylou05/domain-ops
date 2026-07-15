import { Prisma, PrismaClient, RiskLevel, Role, Status } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('demo-password', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@domainscout.demo' },
    update: { name: 'Demo Admin', passwordHash, role: Role.ADMIN, emailVerified: new Date() },
    create: { email: 'admin@domainscout.demo', name: 'Demo Admin', passwordHash, role: Role.ADMIN, emailVerified: new Date() },
  });

  const user = await prisma.user.upsert({
    where: { email: 'investor@domainscout.demo' },
    update: { name: 'Demo Investor', passwordHash, role: Role.OWNER, emailVerified: new Date() },
    create: { email: 'investor@domainscout.demo', name: 'Demo Investor', passwordHash, role: Role.OWNER, emailVerified: new Date() },
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

  for (const source of [
    ['Manual entry', 'MANUAL'], ['Generated ideas', 'GENERATED'], ['Expired inventory', 'EXPIRED'],
    ['Auction feed', 'AUCTION'], ['Closeout feed', 'CLOSEOUT'], ['Trend research', 'TREND'], ['External provider', 'EXTERNAL_PROVIDER'],
  ] as const) {
    await prisma.discoverySource.upsert({ where: { name_type: { name: source[0], type: source[1] } }, update: { enabled: true }, create: { name: source[0], type: source[1], enabled: true, config: { phase: 'discovery-operations' } } });
  }

  let savedDiscovery = await prisma.savedSearch.findFirst({ where: { workspaceId: workspace.id, name: 'Weekly AI closeouts' } });
  savedDiscovery ??= await prisma.savedSearch.create({ data: { workspaceId: workspace.id, createdById: user.id, name: 'Weekly AI closeouts', source: 'CLOSEOUT', schedule: 'WEEKLY', criteria: { query: 'AI automation closeouts', industry: 'AI software', keywords: ['agent', 'workflow'], tlds: ['.com', '.ai'], count: 8 }, nextRunAt: new Date(Date.UTC(2026, 6, 22, 12)) } });

  if (!(await prisma.discoveryJob.findFirst({ where: { workspaceId: workspace.id, savedSearchId: savedDiscovery.id } }))) {
    await prisma.discoveryJob.create({ data: { workspaceId: workspace.id, createdById: user.id, savedSearchId: savedDiscovery.id, source: 'CLOSEOUT', criteria: savedDiscovery.criteria as Prisma.InputJsonValue, status: 'COMPLETED', progress: 100, resultCount: 6, startedAt: new Date(Date.UTC(2026, 6, 14, 12)), completedAt: new Date(Date.UTC(2026, 6, 14, 12, 1)) } });
  }

  await prisma.appSetting.upsert({
    where: { key: 'runtime' },
    update: {},
    create: {
      key: 'runtime',
      value: {
        availabilityProvider: 'mock',
        registrarAdapter: 'generic',
        trademarkProvider: 'mock',
        comparableSalesProvider: 'mock',
        historyProvider: 'mock',
        publicBusinessProvider: 'mock',
        providerEndpoints: { registrar: '', trademark: '', comparableSales: '', history: '', publicBusiness: '' },
        publicBusinessContact: '',
        providerPolicy: { cacheTtlMinutes: 30, staleTtlHours: 24, dailyQuota: 500, minimumIntervalMs: 250 },
        authDiagnosticsEnabled: false,
        workerJobLimit: 5,
        workerLeaseMs: 300000,
        schedulerEnabled: false,
        schedulerPollMs: 60000,
        renewalReminderDays: [90, 60, 30, 14, 7, 1],
        jobSchedules: {
          dailyOpportunityDigest: { enabled: true, intervalMinutes: 1440 },
          buyerResearchRefresh: { enabled: true, intervalMinutes: 360 },
          portfolioSnapshot: { enabled: true, intervalMinutes: 1440 },
          renewalReminders: { enabled: true, intervalMinutes: 1440 },
          savedSearchDiscovery: { enabled: true, intervalMinutes: 60 },
        },
      },
    },
  });

  const professionalPlan = await prisma.plan.upsert({
    where: { name: 'Professional' },
    update: {},
    create: {
      name: 'Professional',
      priceCents: 9900,
      entitlements: {
        create: [
          { key: 'domain_checks', limit: 5000 },
          { key: 'buyer_research', enabled: true, limit: 500 },
          { key: 'reports_generated', enabled: true, limit: 100 },
          { key: 'due_diligence_checks', enabled: true, limit: 500 },
        ],
      },
    },
  });

  const existingSubscription = await prisma.subscription.findFirst({
    where: { workspaceId: workspace.id, planId: professionalPlan.id },
  });

  if (!existingSubscription) {
    await prisma.subscription.create({
      data: {
        workspaceId: workspace.id,
        planId: professionalPlan.id,
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.UTC(2026, 7, 1)),
      },
    });
  }

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

  const offerDomain = domains[1];
  const renewalDomain = domains[3];
  if (offerDomain && !(await prisma.offer.findFirst({ where: { workspaceId: workspace.id, domainId: offerDomain.id } }))) {
    await prisma.offer.create({ data: { workspaceId: workspace.id, domainId: offerDomain.id, amount: 3200, status: 'COUNTERED', buyerName: 'Northstar Automation', buyerEmail: 'acquisitions@example.com', notes: 'Buyer opened at $2,800; countered at $3,200.' } });
  }
  if (renewalDomain) {
    const holding = await prisma.portfolioItem.findFirst({ where: { workspaceId: workspace.id, domainId: renewalDomain.id } });
    if (holding) await prisma.renewal.upsert({ where: { workspaceId_domainId_dueDate: { workspaceId: workspace.id, domainId: renewalDomain.id, dueDate: holding.expirationDate } }, update: {}, create: { workspaceId: workspace.id, domainId: renewalDomain.id, dueDate: holding.expirationDate, cost: holding.renewalCost, recommendation: 'REVIEW', status: 'PENDING' } });
  }
  const soldDomain = domains[0];
  if (soldDomain && !(await prisma.sale.findFirst({ where: { workspaceId: workspace.id, domainId: soldDomain.id } }))) {
    const soldHolding = (await prisma.portfolioItem.findFirst({ where: { workspaceId: workspace.id, domainId: soldDomain.id } })) ?? await prisma.portfolioItem.create({ data: { workspaceId: workspace.id, domainId: soldDomain.id, registrar: 'MockRegistrar', purchaseDate: new Date(Date.UTC(2025, 8, 10)), purchaseCost: 120, renewalCost: 18, expirationDate: new Date(Date.UTC(2026, 8, 10)), currentValuation: 4800, buyNowPrice: 5200, status: 'ARCHIVED', purchaseSource: 'Private acquisition', tags: ['sold', 'ai'] } });
    await prisma.sale.create({ data: { workspaceId: workspace.id, domainId: soldDomain.id, salePrice: 4800, fees: 720, netProfit: 3960, saleDate: new Date(Date.UTC(2026, 5, 20)), source: 'Afternic', notes: `Completed demo sale from holding ${soldHolding.id}.` } });
  }

  const listingSeeds = [
    { domain: domains[1], marketplace: 'Afternic', price: 5400, status: 'ACTIVE' },
    { domain: domains[2], marketplace: 'DAN', price: 6800, status: 'ACTIVE' },
    { domain: domains[3], marketplace: 'Sedo', price: 4800, status: 'PAUSED' },
  ];

  for (const listing of listingSeeds) {
    if (!listing.domain) continue;

    const existingListing = await prisma.marketplaceListing.findFirst({
      where: { workspaceId: workspace.id, domainId: listing.domain.id, marketplace: listing.marketplace },
    });

    if (existingListing) {
      await prisma.marketplaceListing.update({
        where: { id: existingListing.id },
        data: {
          price: listing.price,
          status: listing.status,
        },
      });
    } else {
      await prisma.marketplaceListing.create({
        data: {
          workspaceId: workspace.id,
          domainId: listing.domain.id,
          marketplace: listing.marketplace,
          price: listing.price,
          status: listing.status,
        },
      });
    }
  }

  const historyCheckSeeds = [
    {
      domain: domains[0],
      riskLevel: RiskLevel.MODERATE,
      flags: ['Prior parking page detected', 'Historical outbound links need review'],
      evidence: ['Archive snapshot contained marketplace parking content', 'No malware flags in demo provider data'],
    },
    {
      domain: domains[2],
      riskLevel: RiskLevel.LOW,
      flags: ['Clean development history'],
      evidence: ['No adult, gambling, or pharmaceutical patterns in demo provider data'],
    },
    {
      domain: domains[3],
      riskLevel: RiskLevel.HIGH,
      flags: ['Previous spam-like anchor text', 'Manual review recommended before acquisition'],
      evidence: ['Demo history provider found repetitive outbound anchor patterns'],
    },
  ];

  for (const check of historyCheckSeeds) {
    if (!check.domain) continue;

    const existingCheck = await prisma.domainHistoryCheck.findFirst({
      where: { domainId: check.domain.id },
    });

    if (existingCheck) {
      await prisma.domainHistoryCheck.update({
        where: { id: existingCheck.id },
        data: {
          riskLevel: check.riskLevel,
          flags: check.flags,
          evidence: check.evidence,
        },
      });
    } else {
      await prisma.domainHistoryCheck.create({
        data: {
          domainId: check.domain.id,
          riskLevel: check.riskLevel,
          flags: check.flags,
          evidence: check.evidence,
        },
      });
    }
  }

  const buyerSeeds = [
    {
      domain: domains[1],
      companyName: 'WorkflowNorth',
      website: 'https://example.com/workflownorth',
      industry: 'Workflow automation',
      location: 'Austin, TX',
      reasonForFit: 'Uses workflow automation positioning and could brand a new AI assistant product around this domain.',
      relevanceScore: 91,
      outreachStatus: 'READY',
      contacts: [
        { name: 'Dana Lee', title: 'VP Growth', email: 'dana@example.com', linkedinUrl: 'https://www.linkedin.com/in/example-dana' },
      ],
    },
    {
      domain: domains[2],
      companyName: 'RevenueForge Labs',
      website: 'https://example.com/revenueforge',
      industry: 'Revenue operations',
      location: 'Remote',
      reasonForFit: 'Revenue operations messaging aligns with high-intent SaaS buyer language and resale positioning.',
      relevanceScore: 87,
      outreachStatus: 'READY',
      contacts: [
        { name: 'Mika Patel', title: 'Founder', email: 'mika@example.com', linkedinUrl: null },
      ],
    },
    {
      domain: domains[3],
      companyName: 'AgentLoop Systems',
      website: 'https://example.com/agentloop',
      industry: 'AI agents',
      location: 'San Francisco, CA',
      reasonForFit: 'The domain maps directly to agent orchestration, workflow loops, and AI infrastructure naming patterns.',
      relevanceScore: 82,
      outreachStatus: 'RESEARCHING',
      contacts: [],
    },
  ];

  for (const buyer of buyerSeeds) {
    if (!buyer.domain) continue;

    let buyerRecord = await prisma.buyer.findFirst({
      where: { workspaceId: workspace.id, domainId: buyer.domain.id, companyName: buyer.companyName },
    });

    if (buyerRecord) {
      buyerRecord = await prisma.buyer.update({
        where: { id: buyerRecord.id },
        data: {
          website: buyer.website,
          industry: buyer.industry,
          location: buyer.location,
          reasonForFit: buyer.reasonForFit,
          relevanceScore: buyer.relevanceScore,
          outreachStatus: buyer.outreachStatus,
        },
      });
    } else {
      buyerRecord = await prisma.buyer.create({
        data: {
          workspaceId: workspace.id,
          domainId: buyer.domain.id,
          companyName: buyer.companyName,
          website: buyer.website,
          industry: buyer.industry,
          location: buyer.location,
          reasonForFit: buyer.reasonForFit,
          relevanceScore: buyer.relevanceScore,
          outreachStatus: buyer.outreachStatus,
        },
      });
    }

    for (const contact of buyer.contacts) {
      const existingContact = await prisma.buyerContact.findFirst({
        where: { buyerId: buyerRecord.id, email: contact.email },
      });

      if (!existingContact) {
        await prisma.buyerContact.create({
          data: {
            buyerId: buyerRecord.id,
            name: contact.name,
            title: contact.title,
            email: contact.email,
            linkedinUrl: contact.linkedinUrl,
          },
        });
      }
    }
  }

  let outreachCampaign = await prisma.outreachCampaign.findFirst({
    where: { workspaceId: workspace.id, name: 'AI buyer shortlist' },
  });

  outreachCampaign ??= await prisma.outreachCampaign.create({
    data: {
      workspaceId: workspace.id,
      name: 'AI buyer shortlist',
      status: Status.ACTIVE,
    },
  });

  const outreachMessages = [
    {
      subject: 'Workflow domain fit for your AI product line',
      body: 'Hi Dana,\n\nI noticed WorkflowNorth is expanding around automation workflows. workflowpilot.ai could be a direct-fit brand for an AI workflow assistant or campaign microsite.',
      status: 'APPROVED',
      approvedAt: new Date(Date.UTC(2026, 6, 12, 15, 0)),
    },
    {
      subject: 'Revenue-focused domain opportunity',
      body: 'Hi Mika,\n\nrevenueforge.com aligns with revenue operations, RevOps tooling, and high-intent SaaS positioning. Sharing in case your team is evaluating brandable assets.',
      status: 'DRAFT',
      approvedAt: null,
    },
  ];

  for (const message of outreachMessages) {
    const existingMessage = await prisma.outreachMessage.findFirst({
      where: { workspaceId: workspace.id, campaignId: outreachCampaign.id, subject: message.subject },
    });

    if (existingMessage) {
      await prisma.outreachMessage.update({
        where: { id: existingMessage.id },
        data: {
          body: message.body,
          status: message.status,
          approvedAt: message.approvedAt,
        },
      });
    } else {
      await prisma.outreachMessage.create({
        data: {
          workspaceId: workspace.id,
          campaignId: outreachCampaign.id,
          subject: message.subject,
          body: message.body,
          status: message.status,
          approvedAt: message.approvedAt,
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

  const usageSeeds = [
    { key: 'domain_checks', quantity: 42 },
    { key: 'buyer_research', quantity: 9 },
    { key: 'reports_generated', quantity: 2 },
    { key: 'outreach_messages', quantity: 2 },
  ];

  for (const usage of usageSeeds) {
    const existingUsage = await prisma.usageRecord.findFirst({
      where: { workspaceId: workspace.id, key: usage.key },
    });

    if (existingUsage) {
      await prisma.usageRecord.update({
        where: { id: existingUsage.id },
        data: { quantity: usage.quantity },
      });
    } else {
      await prisma.usageRecord.create({
        data: {
          workspaceId: workspace.id,
          key: usage.key,
          quantity: usage.quantity,
        },
      });
    }
  }

  const aiUsageSeeds = [
    {
      model: 'gpt-4.1-mini',
      promptTokens: 1800,
      completionTokens: 620,
      costCents: 18,
      prompt: 'Summarize opportunity pipeline.',
      output: 'Demo opportunity pipeline report summary.',
    },
    {
      model: 'gpt-4.1-mini',
      promptTokens: 1400,
      completionTokens: 410,
      costCents: 13,
      prompt: 'Draft buyer outreach.',
      output: 'Demo outreach message draft.',
    },
  ];

  for (const usage of aiUsageSeeds) {
    const existingAiUsage = await prisma.aiUsage.findFirst({
      where: { workspaceId: workspace.id, prompt: usage.prompt },
    });

    if (!existingAiUsage) {
      await prisma.aiUsage.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          model: usage.model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          costCents: usage.costCents,
          prompt: usage.prompt,
          output: usage.output,
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

  const integrationSeeds = [
    {
      provider: 'mock_registrar',
      status: Status.ACTIVE,
      config: {
        mode: 'mock',
        description: 'Development registrar provider for deterministic availability and pricing.',
        featureFlag: 'live_registrar_provider',
      },
      credential: 'encrypted:demo-mock-registrar',
    },
    {
      provider: 'buyer_research',
      status: Status.ACTIVE,
      config: {
        mode: 'queued',
        description: 'Buyer research enrichment workflow prepared for background execution.',
        featureFlag: 'buyer_research_jobs',
      },
      credential: 'encrypted:demo-buyer-research',
    },
    {
      provider: 'ai_reports',
      status: Status.PENDING,
      config: {
        mode: 'disabled',
        description: 'AI-assisted report generation waiting on model and policy configuration.',
        featureFlag: 'ai_report_generation',
      },
      credential: null,
    },
  ];

  for (const integration of integrationSeeds) {
    const existingIntegration = await prisma.integration.findFirst({
      where: { workspaceId: workspace.id, provider: integration.provider },
    });

    if (existingIntegration) {
      await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: { status: integration.status, config: integration.config },
      });
    } else {
      await prisma.integration.create({
        data: {
          workspaceId: workspace.id,
          provider: integration.provider,
          status: integration.status,
          config: integration.config,
        },
      });
    }

    if (integration.credential) {
      const existingCredential = await prisma.apiCredential.findFirst({
        where: { workspaceId: workspace.id, provider: integration.provider },
      });

      if (!existingCredential) {
        await prisma.apiCredential.create({
          data: {
            workspaceId: workspace.id,
            provider: integration.provider,
            encryptedSecret: integration.credential,
          },
        });
      }
    }
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
