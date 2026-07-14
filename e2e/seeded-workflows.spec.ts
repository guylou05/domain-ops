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
    await expect(page.getByRole('heading', { name: 'Trademark screening' })).toBeVisible();
    await expect(page.getByText('No matches returned.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comparable sales' })).toBeVisible();
    await expect(page.getByText(/Deterministic|risk/).first()).toBeVisible();
  });
});
