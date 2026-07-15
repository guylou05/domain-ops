# Launch Checklist

## Automated Gates

- Prisma schema and all checked-in migrations validate.
- ESLint, TypeScript, unit tests, and production build pass.
- Client assets remain within `npm run perf:budget` limits.
- Seeded PostgreSQL critical queries remain within `npm run perf:queries` limits.
- Playwright covers public pages, authentication boundaries, mobile navigation, workspace workflows, billing controls, MFA, provider research, and Operations incident handling.
- `npm run smoke:production` verifies Railway health, latency, public routes, auth redirect, and browser security headers.
- Supply-chain policy, vulnerability exceptions, digest/SHA pins, and CycloneDX SBOM generation pass.
- The secret-backed authenticated production canary passes as `VIEWER`, signs out, and leaves no open canary failure issue.

## Responsive And Accessibility Audit

- Keyboard users receive a visible skip link and consistent focus rings.
- Desktop navigation remains persistent at 768 px and wider; smaller viewports use a bounded, scrollable menu with workspace switching and logout.
- Public pricing and authenticated Operations workflows are tested at 390 x 844 without horizontal page overflow.
- Icon-only controls retain accessible names and tooltips; forms use labels, native controls, and semantic headings.
- Dense tables remain horizontally scrollable within their own section instead of expanding the page viewport.

## Release Operator

1. Confirm both GitHub CI jobs are green for the release commit.
2. Confirm Railway applied migrations and reports a healthy deployment.
3. Run the public Production smoke and authenticated production canary workflows manually and verify both schedules are enabled.
4. Confirm current database backup age is within the 24-hour RPO.
5. Confirm transactional alert recipients and provider readiness on Operations and Integrations.
6. Record the release commit, deployment time, smoke result, and rollback owner.
