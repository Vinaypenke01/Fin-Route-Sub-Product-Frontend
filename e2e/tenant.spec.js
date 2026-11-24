// Signed-in smoke tests. Run ONLY against a dedicated test tenant:
//   E2E_TENANT_EMAIL / E2E_TENANT_PASSWORD (skipped when not set).
// They change one payment cell and put the original value back.
// Every test logs out in `finally`, so a failure never leaves the account
// "in use" (which would block the next test's sign-in for 5 minutes).
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_TENANT_EMAIL;
const PASSWORD = process.env.E2E_TENANT_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD (test tenant only) to run signed-in tests');

const saveStatus = page => page.getByTestId('save-status');

async function submitLogin(page) {
  await page.goto('/#login');
  await page.getByPlaceholder(/email/i).first().fill(EMAIL);
  await page.getByPlaceholder(/password/i).first().fill(PASSWORD);
  await page.locator('input[type="checkbox"]').last().check();
  await page.getByRole('button', { name: /Sign In to Tracker/i }).click();
}

async function login(page) {
  await submitLogin(page);
  await expect(page.getByRole('button', { name: /History/i })).toBeVisible({ timeout: 30_000 });
}

/** Log out (if signed in) and wait until the server has freed the device slot. */
async function logout(page) {
  const button = page.getByRole('button', { name: /log ?out|sign ?out/i }).first();
  if (!(await button.isVisible().catch(() => false))) return;
  const released = page.waitForResponse(
    r => r.url().includes('/functions/v1/tenant-session') && r.request().method() === 'POST',
    { timeout: 15_000 },
  ).catch(() => null);
  await button.click();
  const confirm = page.getByRole('button', { name: /confirm|yes|log out anyway/i });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await released;
}

test('sign in, save a payment, reload, it is still there', async ({ page }) => {
  try {
    await login(page);
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });

    const cell = page.locator('table input[type="number"][placeholder="0"]').first();
    await expect(cell).toBeVisible();
    const original = await cell.inputValue();
    const testValue = original === '123' ? '124' : '123';

    await cell.fill(testValue);
    await cell.press('Tab');
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });

    await page.reload();
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });
    await expect(page.locator('table input[type="number"][placeholder="0"]').first()).toHaveValue(testValue);

    // Put the original value back
    const again = page.locator('table input[type="number"][placeholder="0"]').first();
    await again.fill(original);
    await again.press('Tab');
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });

    // The change appears in History
    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText(/Payment (changed|added)/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Close' }).first().click({ timeout: 2_000 }).catch(() => {});
  } finally {
    await logout(page);
  }
});

test('a second device is refused while the first is signed in', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();

  try {
    await login(a);

    await submitLogin(b);
    await expect(b.getByText(/already open on another device/i)).toBeVisible();

    // After the first device logs out, the second can sign in
    await logout(a);
    await b.getByRole('button', { name: /Sign In to Tracker/i }).click();
    await expect(b.getByRole('button', { name: /History/i })).toBeVisible({ timeout: 30_000 });
  } finally {
    await logout(a);
    await logout(b);
    await first.close();
    await second.close();
  }
});
