import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// The click-through runs the production build against its own database (hub_e2e), emptied before each run.
const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://hub:hub@localhost:5432/hub_e2e';
const PORT = 3100;
export const E2E_TOKEN = 'e2e-ingest-token-0123456789';
export const BASE_URL = `http://localhost:${PORT}`;
// Sign-in emails are written here instead of sent (MAIL_OUTBOX_FILE), so tests can open the link.
export const OUTBOX = path.join(os.tmpdir(), 'msl-test-hub-e2e-outbox.jsonl');
export const SIGNED_IN_STATE = path.join(import.meta.dirname, 'e2e', '.auth', 'signed-in.json');
export const ALLOWED = 'qa@example.com, @mystudylife.test';

process.env.E2E_DATABASE_URL = E2E_DB;

export default defineConfig({
  testDir: './e2e',
  // Tests share one database and build on each other's data (import, then upload, then browse).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: './e2e/global-setup.ts',
  // Signed in by default (a session made in global-setup); auth.spec.ts starts signed out.
  use: { baseURL: BASE_URL, trace: 'retain-on-failure', storageState: SIGNED_IN_STATE },
  // The installed Google Chrome; Playwright's own Chromium download is blocked in some sandboxes.
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    // Migrate before starting; the readiness check polls the sign-in page.
    command: `npx drizzle-kit migrate && npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DB,
      INGEST_TOKEN: E2E_TOKEN,
      APP_URL: BASE_URL,
      ALLOWED_EMAILS: ALLOWED,
      MAIL_OUTBOX_FILE: OUTBOX,
    },
  },
});
