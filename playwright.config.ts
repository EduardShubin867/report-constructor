import { defineConfig, devices } from '@playwright/test';

const host = '127.0.0.1';
const port = 3100;
const baseURL = `http://${host}:${port}/constructor`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: 'list',
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `mkdir -p .next/standalone/.next && cp -R .next/static .next/standalone/.next/static && if [ -d public ]; then cp -R public .next/standalone/public; fi && cd .next/standalone && HOSTNAME=${host} PORT=${port} node server.js`,
    url: `${baseURL}/reports/manual`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  workers: process.env.CI ? 1 : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
