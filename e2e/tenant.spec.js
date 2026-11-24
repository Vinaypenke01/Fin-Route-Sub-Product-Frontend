// Signed-in smoke tests. Run ONLY against a dedicated test tenant:
//   E2E_TENANT_EMAIL / E2E_TENANT_PASSWORD (skipped when not set).
// They change one payment cell and put the original value back.
// Every test logs out in `finally`, so a failure never leaves the account
// "in use" (which would block the next test's sign-in for 5 minutes).
import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_TENANT_EMAIL;
const PASSWORD = process.env.E2E_TENANT_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'Set E2E_TENANT_EMAIL and E2E_TENANT_PASSWORD (test tenant only) to run signed-in tests');
// The live databases can be slow to wake up; these flows need more than 60 s.
test.setTimeout(180_000);
// One run at a time: a failed attempt must not race the retry for the device slot.
test.describe.configure({ retries: 0 });

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
  if (page.isClosed()) return;
  // Close any open window first (History, dialogs) so nothing covers the button
  await page.keyboard.press('Escape').catch(() => {});
  const button = page.getByRole('button', { name: /log ?out|sign ?out/i }).first();
  if (!(await button.isVisible().catch(() => false))) return;
  const released = page.waitForResponse(
    r => r.url().includes('/functions/v1/tenant-session') && r.request().method() === 'POST',
    { timeout: 15_000 },
  ).catch(() => null);
  // dispatchEvent cannot be blocked by an overlay, so cleanup never hangs
  await button.dispatchEvent('click');
  const confirm = page.getByRole('button', { name: /confirm|yes|log out anyway/i });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await released;
}

test('sign in, save a payment, reload, it is still there', async ({ page }) => {
  try {
    await login(page);
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });

    // A customer's payment cell (click to edit), not the cash settlement boxes
    const cell = () => page.getByTestId('payment-cell').first();
    const editCell = async () => { await cell().click(); const input = cell().locator('input'); await expect(input).toBeVisible(); return input; };

    let input = await editCell();
    const original = await input.inputValue();
    const testValue = original === '123' ? '124' : '123';
    await input.fill(testValue);
    await input.press('Enter');
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });

    await page.reload();
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });
    input = await editCell();
    await expect(input).toHaveValue(testValue);

    // Put the original value back
    await input.fill(original);
    await input.press('Enter');
    await expect(saveStatus(page)).toHaveText(/All changes saved/i, { timeout: 30_000 });

    // The change appears in History
    await page.getByRole('button', { name: /History/i }).click();
    // The History window (found by its search box, so this works with or without the dialog role)
    const history = page.locator('div.fixed.inset-0').filter({ has: page.getByPlaceholder(/Search by customer/i) });
    await expect(history).toBeVisible({ timeout: 15_000 });
    const entry = history.getByText(/Payment (changed|added|deleted)/i).first();
    try {
      await expect(entry).toBeVisible({ timeout: 30_000 });
    } catch {
      const shown = (await history.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
      throw new Error(`History did not list the payment change. The window shows: "${shown}"`);
    }
    await history.getByRole('button', { name: 'Close' }).click();
    await expect(history).toHaveCount(0);
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
