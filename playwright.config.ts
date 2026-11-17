import { defineConfig, devices } from '@playwright/test';

// The click-through runs the production build against its own database (hub_e2e), emptied before each run.
const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://hub:hub@localhost:5432/hub_e2e';
const PORT = 3100;
export const E2E_TOKEN = 'e2e-ingest-token-0123456789';

process.env.E2E_DATABASE_URL = E2E_DB;

export default defineConfig({
  testDir: './e2e',
  // Tests share one database and build on each other's data (import, then upload, then browse).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // The installed Google Chrome; Playwright's own Chromium download is blocked in some sandboxes.
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    // Migrate first: Playwright polls the overview page, which reads the database, to know the server is up.
    command: `npx drizzle-kit migrate && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: E2E_DB, INGEST_TOKEN: E2E_TOKEN },
  },
});
