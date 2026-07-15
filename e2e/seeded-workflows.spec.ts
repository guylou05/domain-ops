import { expect, test, type Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';
import { prisma } from '../src/lib/prisma';
import { getAppConfig, upsertAppConfig } from '../src/lib/server/app-config';

const runSeededWorkflows = process.env.E2E_WORKFLOWS === '1' && Boolean(process.env.DATABASE_URL);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('email@example.com').fill('investor@domainscout.demo');
  await page.getByPlaceholder('Password').fill('demo-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/overview/);
}

test.describe('seeded workspace workflows', () => {
  test.skip(!runSeededWorkflows, 'Set E2E_WORKFLOWS=1 with a migrated and seeded DATABASE_URL to run workspace workflow tests.');

  test('generator persists opportunities into the workspace', async ({ page }) => {
    await login(page);
    await page.goto('/domain-generator');

    await page.getByPlaceholder('Business concept, e.g. workflow automation').fill(`playwright automation ${Date.now()}`);
    await page.getByPlaceholder('Industry, e.g. SaaS').fill('SaaS');
    await page.getByPlaceholder('Keywords: agent, revenue, ops').fill('agent, ops');
    await page.locator('input[name="count"]').fill('3');
    await page.getByRole('button', { name: 'Generate, analyze, and save' }).click();

    await expect(page.getByText(/Saved \d+ generated opportunities\./)).toBeVisible();
    await page.goto('/opportunities?search=agent&sort=score');
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByText('Domain Checks')).toBeVisible();
    await expect(page.getByText(/\d+ \/ 5000/)).toBeVisible();
  });

  test('watchlisted opportunity can be acquired into portfolio', async ({ page }) => {
    await login(page);
    await page.goto('/opportunities');

    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/watchlists/);
    await page.getByRole('button', { name: 'Acquire' }).first().click();
    await expect(page).toHaveURL(/\/portfolio/);
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  });

  test('domain progresses from opportunity through acquisition, negotiation, renewal decision, and sale', async ({ page }) => {
    await login(page);
    await page.goto('/domain-generator');
    const concept = `lifecycle ${Date.now()}`;
    await page.getByPlaceholder('Business concept, e.g. workflow automation').fill(concept);
    await page.getByPlaceholder('Industry, e.g. SaaS').fill('Domain investing');
    await page.getByPlaceholder('Keywords: agent, revenue, ops').fill('lifecycle, asset');
    await page.locator('input[name="count"]').fill('1');
    await page.getByRole('button', { name: 'Generate, analyze, and save' }).click();
    await expect(page.getByText(/Saved \d+ generated opportunities\./)).toBeVisible();

    await page.goto('/opportunities?sort=newest');
    const row = page.locator('tbody tr').first();
    const domain = (await row.locator('a').first().textContent())!.trim();
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/watchlists/);
    const watchlistItem = page.getByText(domain, { exact: true }).locator('xpath=ancestor::tr');
    await watchlistItem.getByRole('button', { name: 'Acquire' }).click();
    await expect(page).toHaveURL(/\/portfolio/);
    await page.getByRole('link', { name: domain, exact: true }).click();

    await page.getByPlaceholder('Amount').fill('2500');
    await page.getByPlaceholder('Buyer name').fill('Playwright Buyer');
    await page.getByRole('button', { name: 'Record offer' }).click();
    await expect(page.getByText(/\$2,500/)).toBeVisible();

    await page.locator('select[name="decision"]').selectOption('KEEP');
    await page.getByPlaceholder('Decision rationale').fill('Active negotiation supports renewal.');
    await page.getByRole('button', { name: 'Save decision' }).click();
    await expect(page.getByText(/KEEP/).last()).toBeVisible();

    await page.getByPlaceholder('Sale price').fill('3000');
    await page.getByPlaceholder('Fees').fill('450');
    await page.getByPlaceholder('Marketplace/source').fill('Playwright Market');
    await page.getByRole('button', { name: 'Record completed sale' }).click();
    await expect(page.getByRole('heading', { name: 'Completed sales' })).toBeVisible();
    await expect(page.getByText(/\$3,000 sale/)).toBeVisible();
    await page.goto('/overview');
    await expect(page.getByText('Sales revenue', { exact: true })).toBeVisible();
  });

  test('scheduled discovery, CSV mobility, bulk review, export, and workspace isolation', async ({ page }) => {
    const suffix = Date.now();
    const importedDomain = `mobility${suffix}.com`;
    const foreignWorkspace = await prisma.workspace.create({ data: { name: 'Foreign Discovery Workspace', slug: `foreign-discovery-${suffix}` } });
    const foreignBatch = await prisma.importBatch.create({
      data: { workspaceId: foreignWorkspace.id, createdById: 'foreign-user', filename: 'private.csv', industry: 'private', totalRows: 1, validRows: 1, duplicateRows: 0, errorRows: 0, rows: [{ row: 2, domain: 'private-workspace-only.com', status: 'VALID', message: 'Ready to import.' }] },
    });

    await login(page);
    await page.goto('/discovery');
    await expect(page.getByRole('heading', { name: 'Discovery operations' })).toBeVisible();

    await page.getByPlaceholder('Search name').fill(`Daily trends ${suffix}`);
    await page.locator('form').filter({ has: page.getByPlaceholder('Search name') }).locator('select[name="schedule"]').selectOption('DAILY');
    await page.locator('form').filter({ has: page.getByPlaceholder('Search name') }).locator('select[name="source"]').selectOption('TREND');
    await page.locator('form').filter({ has: page.getByPlaceholder('Search name') }).getByPlaceholder('Search concept').fill(`mobility trend ${suffix}`);
    await page.getByRole('button', { name: 'Save search' }).click();
    await expect(page.getByText(`Daily trends ${suffix}`)).toBeVisible();
    await page.getByText(`Daily trends ${suffix}`).locator('xpath=ancestor::div[contains(@class,"border-l-2")]').getByRole('button', { name: 'Run' }).click();
    const queuedJob = page.getByText(/Trend.*QUEUED/).first().locator('xpath=ancestor::div[contains(@class,"border-l-2")]');
    await expect(queuedJob).toBeVisible();
    await queuedJob.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/Trend.*CANCELLED/).first()).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'mobility.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`domain\n${importedDomain}\nworkflowpilot.ai\n${importedDomain}\n=cmd()`),
    });
    await page.getByRole('button', { name: 'Review file' }).click();
    await expect(page.getByText('1 valid')).toBeVisible();
    await expect(page.getByText(/duplicates/)).toBeVisible();
    await expect(page.getByText(/errors/)).toBeVisible();
    await page.getByRole('button', { name: 'Import valid rows' }).click();
    await expect(page).toHaveURL(/\/opportunities\?imported=1/);

    await page.goto(`/opportunities?search=${importedDomain}`);
    await page.getByLabel(`Select ${importedDomain}`).check();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('APPROVED')).toBeVisible();
    await page.getByLabel(`Select ${importedDomain}`).check();
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.getByRole('heading', { name: 'Opportunity comparison' })).toBeVisible();
    await page.getByLabel(`Select ${importedDomain}`).check();
    await page.getByRole('button', { name: 'Add to watchlist' }).click();
    await page.goto('/watchlists');
    await expect(page.getByText(importedDomain, { exact: true })).toBeVisible();

    const exportResponse = await page.request.get('/api/exports/opportunities');
    expect(exportResponse.ok()).toBe(true);
    expect(exportResponse.headers()['content-disposition']).toContain('opportunities.csv');
    expect(await exportResponse.text()).toContain(importedDomain);

    await page.goto(`/discovery?batch=${foreignBatch.id}`);
    await expect(page.getByText('private-workspace-only.com')).not.toBeVisible();
    await expect(page.getByText('private.csv')).not.toBeVisible();
  });

  test('admin can queue background jobs', async ({ page }) => {
    await login(page);
    await page.goto('/admin');

    await page.locator('select[name="type"]').selectOption('portfolio_snapshot');
    await page.getByRole('button', { name: 'Queue job' }).click();
    const queuedJobHeading = page.getByRole('heading', { name: 'Portfolio Snapshot', exact: true }).first();
    await expect(queuedJobHeading).toBeVisible();
    await expect(queuedJobHeading.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]').getByText(/QUEUED|RUNNING|COMPLETED/)).toBeVisible();
  });

  test('opportunity due diligence persists provider results', async ({ page }) => {
    await login(page);
    await page.goto('/opportunities');
    await page.locator('tbody a').first().click();

    await page.getByRole('button', { name: 'Run due diligence' }).click();
    await expect(page.getByText('Due diligence completed.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trademark screening' })).toBeVisible();
    await expect(page.getByText('No matches returned.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comparable sales' })).toBeVisible();
    await expect(page.getByText(/Deterministic|risk/).first()).toBeVisible();
  });

  test('admin can inspect and resolve an operational failure', async ({ page }) => {
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { slug: 'demo-domain-portfolio' }, select: { id: true } });
    const failure = await prisma.operationalEvent.create({
      data: {
        workspaceId: workspace.id,
        source: 'provider',
        level: 'ERROR',
        outcome: 'FAILURE',
        event: 'provider.playwright_probe',
        message: 'Synthetic provider timeout for the operational workflow test.',
      },
    });

    await login(page);
    await page.goto('/operations');
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Source health' })).toBeVisible();
    const incident = page.getByText('Synthetic provider timeout for the operational workflow test.').first().locator('xpath=ancestor::div[contains(@class,"border-l-2")]');
    await expect(incident).toBeVisible();
    await incident.getByRole('button', { name: 'Resolve' }).click();
    await expect(incident).not.toBeVisible();
    await expect.poll(async () => (await prisma.operationalEvent.findUniqueOrThrow({ where: { id: failure.id } })).resolvedAt).not.toBeNull();
  });

  test('application navigation remains usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await page.getByRole('link', { name: 'Operations', exact: true }).click();
    await expect(page).toHaveURL(/\/operations/);
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('admin can store a provider credential from the UI', async ({ page }) => {
    await login(page);
    await page.goto('/integrations');

    const input = page.getByLabel('Registrar availability API key');
    await input.fill(`playwright-provider-key-${Date.now()}`);
    await input.locator('xpath=ancestor::form').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Stored .+/).first()).toBeVisible();
  });

  test('billing setup is managed from Settings and Integrations', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.getByText('Email verified', { exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Subscription billing' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Abuse protection' })).toBeVisible();
    await expect(page.getByText('Backend: Redis configured')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start paid subscription' })).toBeDisabled();
    await page.goto('/integrations');
    await expect(page.getByLabel('Stripe secret key API key')).toBeVisible();
    await expect(page.getByLabel('Stripe webhook secret API key')).toBeVisible();
  });

  test('owner can invite a teammate who joins the workspace', async ({ page }) => {
    await login(page);
    await page.goto('/admin');

    const email = `playwright-team-${Date.now()}@domainscout.demo`;
    await page.getByPlaceholder('teammate@example.com').fill(email);
    await page.locator('form').filter({ has: page.getByPlaceholder('teammate@example.com') }).locator('select[name="role"]').selectOption('VIEWER');
    await page.getByRole('button', { name: 'Invite' }).click();

    const invitationPath = await page.getByText(/^\/invite\//).textContent();
    expect(invitationPath).toBeTruthy();
    await page.goto(invitationPath!);
    await expect(page.getByRole('heading', { name: /Join Demo Domain Portfolio/ })).toBeVisible();
    await page.getByPlaceholder('Your name').fill('Playwright Teammate');
    await page.locator('input[name="password"]').fill('playwright-password');
    await page.getByRole('button', { name: 'Join workspace' }).click();
    await expect(page.getByText('Workspace access is ready. Sign in with this email and password.')).toBeVisible();

    await page.goto('/overview');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill('playwright-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/overview/);
    await page.goto('/admin');
    await expect(page.getByText('Role: VIEWER')).toBeVisible();
  });

  test('registration provisions a trial workspace and signs in', async ({ page }) => {
    const email = `playwright-signup-${Date.now()}@domainscout.demo`;
    await page.goto('/register?plan=Professional');
    await page.getByPlaceholder('Name').fill('Playwright Founder');
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill('playwright-password');
    await page.getByRole('button', { name: 'Start trial' }).click();

    await expect(page).toHaveURL(/\/overview/);
    await page.goto('/settings');
    await expect(page.getByText('Email unverified', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send verification email' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Professional' })).toBeVisible();
    await expect(page.getByText(/Trialing/)).toBeVisible();
    await expect(page.getByText('0 / 5000')).toBeVisible();

    await page.locator('input[name="currentPassword"]').fill('playwright-password');
    await page.getByPlaceholder('New password', { exact: true }).fill('playwright-password-updated');
    await page.getByPlaceholder('Confirm new password').fill('playwright-password-updated');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed successfully.')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill('playwright-password-updated');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/overview/);
  });

  test('user can enroll in MFA, complete step-up, and revoke another session', async ({ page, browser }) => {
    const email = `playwright-mfa-${Date.now()}@domainscout.demo`;
    const password = 'playwright-password';
    await page.goto('/register?plan=Professional');
    await page.getByPlaceholder('Name').fill('MFA User');
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Start trial' }).click();
    await expect(page).toHaveURL(/\/overview/);

    const user = await prisma.user.update({ where: { email }, data: { emailVerified: new Date() }, select: { id: true } });
    await page.goto('/settings');
    const mfaPanel = page.getByRole('heading', { name: 'Two-factor authentication' }).locator('xpath=ancestor::div[contains(@class,"card")]');
    await mfaPanel.getByPlaceholder('Current password').fill(password);
    await mfaPanel.getByRole('button', { name: 'Set up authenticator' }).click();
    await expect(mfaPanel.getByAltText('Authenticator QR code')).toBeVisible();
    const secret = (await mfaPanel.locator('code').first().textContent())!;
    const totp = new OTPAuth.TOTP({ secret, digits: 6, period: 30 });
    await mfaPanel.getByPlaceholder('6-digit authenticator code').fill(totp.generate());
    await mfaPanel.getByRole('button', { name: 'Enable two-factor authentication' }).click();
    await expect(mfaPanel.getByText('Recovery codes', { exact: true })).toBeVisible();
    await expect(mfaPanel.getByText('Enabled', { exact: true }).first()).toBeVisible();

    const trackedSession = await prisma.authSession.findFirstOrThrow({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    await prisma.authSession.update({ where: { id: trackedSession.id }, data: { stepUpAt: new Date(Date.now() - 20 * 60 * 1000) } });
    await page.reload();
    await page.getByRole('button', { name: 'Save runtime settings' }).click();
    await expect(page).toHaveURL(/\/confirm-access/);
    await page.getByPlaceholder('Authenticator or recovery code').fill(totp.generate());
    await page.getByRole('button', { name: 'Confirm access' }).click();
    await expect(page).toHaveURL(/\/settings/);

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByPlaceholder('Authenticator or recovery code').fill(totp.generate());
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/overview/);

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await secondPage.goto('/login');
    await secondPage.getByPlaceholder('email@example.com').fill(email);
    await secondPage.getByPlaceholder('Password').fill(password);
    await secondPage.getByRole('button', { name: 'Sign in' }).click();
    await secondPage.getByPlaceholder('Authenticator or recovery code').fill(totp.generate());
    await secondPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(secondPage).toHaveURL(/\/overview/);

    await page.goto('/settings');
    await expect(page.getByText('2 active sessions')).toBeVisible();
    await page.getByRole('button', { name: 'End other sessions' }).click();
    await expect(page.getByText('1 active session')).toBeVisible();
    await secondPage.goto('/overview');
    await expect(secondPage).toHaveURL(/\/login\?session=expired/);
    await secondContext.close();
  });

  test('member can switch between authorized workspaces', async ({ page }) => {
    const email = `playwright-multi-${Date.now()}@domainscout.demo`;
    const password = 'playwright-password';
    await page.goto('/register?plan=Professional');
    await page.getByPlaceholder('Name').fill('Multi Workspace User');
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Start trial' }).click();
    await expect(page).toHaveURL(/\/overview/);
    await page.getByRole('button', { name: 'Log out' }).click();

    await login(page);
    await page.goto('/admin');
    await page.getByPlaceholder('teammate@example.com').fill(email);
    await page.locator('form').filter({ has: page.getByPlaceholder('teammate@example.com') }).locator('select[name="role"]').selectOption('VIEWER');
    await page.getByRole('button', { name: 'Invite' }).click();
    const invitationPath = await page.getByText(/^\/invite\//).textContent();
    expect(invitationPath).toBeTruthy();
    await page.goto(invitationPath!);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Join workspace' }).click();
    await expect(page.getByText('Workspace access is ready. Sign in with this email and password.')).toBeVisible();

    await page.goto('/overview');
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/overview/);

    await page.getByLabel('Current workspace').selectOption({ label: 'Demo Domain Portfolio' });
    await page.getByRole('button', { name: 'Switch workspace' }).click();
    await expect(page.locator('aside').getByText('VIEWER', { exact: true })).toBeVisible();
    await page.goto('/settings');
    await expect(page.locator('input[name="name"]')).toHaveValue('Demo Domain Portfolio');
    await expect(page.getByText('Role: VIEWER')).toBeVisible();
  });

  test('credential preflight blocks repeated account attempts', async ({ page }) => {
    const original = await getAppConfig();
    const email = `playwright-limited-${Date.now()}@domainscout.demo`;
    const startedAt = new Date();
    await upsertAppConfig({
      ...original,
      abuseProtection: { ...original.abuseProtection, enabled: true, loginAccountLimit: 3 },
    });

    try {
      await page.goto('/login');
      await page.getByPlaceholder('email@example.com').fill(email);
      await page.getByPlaceholder('Password').fill('incorrect-password');
      const button = page.getByRole('button', { name: 'Sign in' });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await button.click();
        await expect(button).toBeEnabled();
      }
      await button.click();
      await expect(page.getByText('Too many attempts. Try again in 15 minutes.')).toBeVisible();
      await expect(prisma.operationalEvent.findFirst({ where: { event: 'abuse.login_preflight_account_blocked', occurredAt: { gte: startedAt } } })).resolves.not.toBeNull();
    } finally {
      await upsertAppConfig(original);
    }
  });
});
