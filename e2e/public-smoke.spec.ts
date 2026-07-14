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
