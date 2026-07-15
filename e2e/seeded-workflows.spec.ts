import { expect, test, type Page } from '@playwright/test';

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

  test('admin can queue background jobs', async ({ page }) => {
    await login(page);
    await page.goto('/admin');

    await page.locator('select[name="type"]').selectOption('portfolio_snapshot');
    await page.getByRole('button', { name: 'Queue job' }).click();
    await expect(page.getByText(/Portfolio Snapshot/i)).toBeVisible();
    await expect(page.getByText(/QUEUED|RUNNING|COMPLETED/)).toBeVisible();
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

  test('admin can store a provider credential from the UI', async ({ page }) => {
    await login(page);
    await page.goto('/integrations');

    const input = page.getByLabel('Registrar availability API key');
    await input.fill(`playwright-provider-key-${Date.now()}`);
    await input.locator('xpath=ancestor::form').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/Stored .+/).first()).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Professional' })).toBeVisible();
    await expect(page.getByText(/Trialing/)).toBeVisible();
    await expect(page.getByText('0 / 5000')).toBeVisible();

    await page.getByPlaceholder('Current password').fill('playwright-password');
    await page.getByPlaceholder('New password').fill('playwright-password-updated');
    await page.getByPlaceholder('Confirm new password').fill('playwright-password-updated');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Password changed successfully.')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.getByPlaceholder('email@example.com').fill(email);
    await page.getByPlaceholder('Password').fill('playwright-password-updated');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/overview/);
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
    await expect(page).toHaveURL(/\/overview/);
    await page.goto('/settings');
    await expect(page.locator('input[name="name"]')).toHaveValue('Demo Domain Portfolio');
    await expect(page.getByText('Role: VIEWER')).toBeVisible();
  });
});
