# Deal Lifecycle and Renewal Operations

## Workflow

An opportunity can be saved to a watchlist and acquired into the portfolio. Each holding detail page supports acquisition metadata, current pricing, marketplace listings, offers and negotiation status, a completed sale, renewal decisions, and an audited activity trail. Recording a sale archives the active holding while preserving its financial history.

Sale profit is `sale price - fees - purchase cost`. Realized ROI divides net profit by purchase cost. Holding period is measured from purchase date through sale date. Dashboard financial metrics are calculated from persisted `Sale`, `Offer`, and `PortfolioItem` records.

## Renewal Intelligence

The renewal calendar covers active holdings and calculates a deterministic `KEEP`, `REVIEW`, or `DROP` recommendation. Active offers take priority, high-risk or deeply uneconomic holdings are marked `DROP`, and strong scores with sufficient valuation-to-cost coverage are marked `KEEP`.

Workspace administrators configure reminder thresholds and job cadence in Settings. The `renewal_reminders` worker task upserts a pending renewal record and creates idempotent member notifications when a holding reaches a configured threshold. The scheduler and worker require the same `DATABASE_URL` and `REDIS_URL` used by the deployed services.

## Deployment and Rollback

Deploy migration `20260715050000_deal_lifecycle` before starting the new application build. The migration only adds nullable/defaulted columns, foreign keys, and indexes. Existing offers, sales, renewals, and holdings remain valid. Rollback should use a forward migration that removes the new constraints and columns only after exporting lifecycle records; do not manually edit Prisma migration history in production.

After deployment, verify `/portfolio`, one `/portfolio/[id]` detail page, `/renewals`, dashboard financial metrics, Runtime Settings reminder controls, and one queued `renewal_reminders` job. The seeded Playwright lifecycle test covers opportunity, watchlist, acquisition, offer, renewal decision, and sale transitions.
