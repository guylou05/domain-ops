import { expect, test } from '@playwright/test';

test('pricing page renders public plan content', async ({ page }) => {
  await page.goto('/pricing');

  await expect(page.getByRole('heading', { name: 'Domain research workflows for focused investors.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Professional' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start 14-day trial' })).toBeVisible();
});

test('login page exposes credential sign-in and hides Google when not configured', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
});

test('protected routes redirect unauthenticated users to login', async ({ page }) => {
  await page.goto('/overview');

  await expect(page).toHaveURL(/\/login/);
});

test('public workflows remain keyboard accessible and fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pricing');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
