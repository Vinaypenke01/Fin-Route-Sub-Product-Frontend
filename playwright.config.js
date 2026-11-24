// End-to-end smoke tests (real browser).
//
//   Local build:   npx playwright test            (builds + serves on :4173)
//   Live / preview site:
//     $env:E2E_BASE_URL = "https://sub-project.fin-route.site"; npx playwright test
//   Signed-in tests also need a DEDICATED TEST TENANT (never a real business):
//     $env:E2E_TENANT_EMAIL = "..."; $env:E2E_TENANT_PASSWORD = "..."
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const useLocalServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // signed-in tests share one test tenant
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list', // 'github' turns failures into annotations
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: useLocalServer
    ? {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
