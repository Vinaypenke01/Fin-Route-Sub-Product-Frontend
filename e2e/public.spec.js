// Smoke tests that need no account. Safe to run against the live site.
import { test, expect } from '@playwright/test';

test('landing page loads without the PDF library @phone', async ({ page }) => {
  const scripts = [];
  page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await page.goto('/');
  await expect(page.getByText('Partner Sign In').first()).toBeVisible();
  // The 900 kB PDF library must only load when a PDF is requested
  expect(scripts.some(u => u.includes('html2pdf'))).toBe(false);
});

test('no horizontal scrolling on a phone @phone', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('login screen: validation, forgot password, and a refused login', async ({ page }) => {
  await page.goto('/#login');
  await expect(page.getByRole('button', { name: /Sign In to Tracker/i })).toBeVisible();

  // Forgot password explains what to do
  await page.getByRole('button', { name: /Forgot password/i }).click();
  await expect(page.getByText(/Ask your FinRoute administrator/i)).toBeVisible();

  // Empty form is rejected on the device
  await page.getByRole('button', { name: /Sign In to Tracker/i }).click();
  await expect(page.getByText(/required/i).first()).toBeVisible();

  // Unknown account is refused (no ledger shown)
  await page.getByPlaceholder(/email/i).first().fill('nobody-e2e@example.invalid');
  await page.getByPlaceholder(/password/i).first().fill('not-a-real-password');
  await page.locator('input[type="checkbox"]').last().check(); // terms consent
  await page.getByRole('button', { name: /Sign In to Tracker/i }).click();
  await expect(page.locator('.bg-red-50').first()).toBeVisible();
  await expect(page.getByText(/All changes saved|Supabase DB/i)).toHaveCount(0);
});

test('admin login page is reachable', async ({ page }) => {
  await page.goto('/#admin');
  await expect(page.getByPlaceholder(/admin@/i).first()).toBeVisible();
});
