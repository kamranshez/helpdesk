import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      // dotenv does NOT override existing env vars, so DATABASE_URL here
      // takes precedence over what server/.env would set.
      command: 'bun run dev:server',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'postgresql://helpdesk:helpdesk@localhost:5432/helpdesk_test?schema=public',
        CLIENT_URL: 'http://localhost:5173',
        TRUSTED_ORIGIN: 'http://localhost:5173',
        BETTER_AUTH_SECRET: 'test-secret-do-not-use-in-production-xxxxx',
        BETTER_AUTH_URL: 'http://localhost:3000',
        SESSION_SECRET: 'test-session-secret',
      },
    },
    {
      command: 'bun run dev:client',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
