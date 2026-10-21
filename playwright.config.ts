import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 2,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5175',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'popup', grep: /@responsive/, use: { viewport: { width: 600, height: 600 } } },
  ],
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: !process.env.CI,
  },
});