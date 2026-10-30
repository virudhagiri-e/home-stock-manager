import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  // Tests share one database, so files must not run at the same time.
  workers: 1,
  retries: 0,
  globalSetup: './playwright.global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/e2e/product-stub.mjs',
      url: 'http://localhost:4010/off/api/v2/product/3017624010701.json',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVERS === 'true',
    },
    {
      command: 'npm run dev:server',
      url: 'http://localhost:4000/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVERS === 'true',
      env: {
        ...process.env,
        OPEN_FOOD_FACTS_URL: 'http://localhost:4010/off',
        OPEN_PRODUCTS_FACTS_URL: 'http://localhost:4010/opf',
      } as Record<string, string>,
    },
    {
      command: 'npm run dev -w packages/client -- --host=localhost --port=5173',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVERS === 'true',
    },
  ],
})
