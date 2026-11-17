import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { E2E_TOKEN } from '../playwright.config';

// One story, in order: empty hub, import the sheet, upload a run, browse it, edit a case.
// Every test also fails on any browser console error or uncaught page error.
// Next keeps visited pages in the document, hidden, so label lookups are filtered to visible elements.
test.describe.configure({ mode: 'serial' });

const consoleErrors: string[] = [];
test.beforeEach(({ page }) => {
  consoleErrors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
});
test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([]);
});

const allureFixture = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'src/lib/ingest/__fixtures__/allure-results.json'), 'utf8'),
);

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page wider than the viewport').toBeLessThanOrEqual(0);
}

test('empty hub explains how to start, and its links go somewhere real', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expect(page.getByText('No runs yet.')).toBeVisible();
  await expect(page.getByText('No test cases yet.')).toBeVisible();

  await page.getByRole('link', { name: 'Add the upload step' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Setup' })).toBeVisible();
  await expect(page.getByText('http://localhost:3100', { exact: true })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Runs' }).click();
  await expect(page.getByText('No runs uploaded yet.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Runs' })).toHaveAttribute('aria-current', 'page');
});

test('the ingest endpoint rejects a missing token and a malformed body', async ({ request }) => {
  const noToken = await request.post('/api/ingest', { data: {} });
  expect(noToken.status()).toBe(401);

  const bad = await request.post('/api/ingest', {
    headers: { authorization: `Bearer ${E2E_TOKEN}` },
    data: { suite: 'x', platform: 'web', format: 'allure' },
  });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toBe('Body does not match the ingest format.');
});

test('importing the sheet: columns are guessed, the preview matches, and cases are saved', async ({ page }) => {
  await page.goto('/cases');
  await page.getByRole('link', { name: 'import it as .xlsx or .csv' }).click();
  await expect(page).toHaveURL(/\/cases\/import$/);

  // No file chosen: the browser's own required-field check stops the submit.
  const fileInput = page.getByLabel('Test case sheet (.xlsx or .csv)').filter({ visible: true });
  await page.getByRole('button', { name: 'Read file' }).click();
  expect(await fileInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await expect(page.getByText('Header found on row')).toHaveCount(0);

  await page.getByLabel('Test case sheet (.xlsx or .csv)').filter({ visible: true }).setInputFiles(path.join(import.meta.dirname, 'fixtures/cases.csv'));
  await page.getByRole('button', { name: 'Read file' }).click();

  await expect(page.getByText('Header found on row 2.')).toBeVisible();
  await expect(page.getByLabel('ID', { exact: true }).filter({ visible: true })).toHaveValue('0');
  await expect(page.getByLabel('Title', { exact: true }).filter({ visible: true })).toHaveValue('1');
  await expect(page.getByLabel('Automated (optional)').filter({ visible: true })).toHaveValue('4');
  await expect(page.getByText('7 cases ready to import.')).toBeVisible();

  // Unmapping a required column blocks the import instead of saving half the data.
  await page.getByLabel('Title', { exact: true }).filter({ visible: true }).selectOption('');
  await expect(page.getByText('Pick the ID and Title columns to see what will be imported.')).toBeVisible();
  await page.getByLabel('Title', { exact: true }).filter({ visible: true }).selectOption('1');

  const preview = page.getByRole('table');
  await expect(preview.getByRole('row').nth(1)).toContainText('AUTH-001');
  await expect(preview.getByRole('row').nth(1)).toContainText('1. Authentication');

  await page.getByRole('button', { name: 'Import 7 cases' }).click();
  await expect(page.getByRole('status')).toContainText('Imported: 7 new, 0 updated, 0 kept as they were.');

  await page.getByRole('link', { name: 'Open the test cases' }).click();
  await expect(page).toHaveURL(/\/cases$/);
  await expect(page.getByText('7 cases', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WEB-11' })).toBeVisible();
});

test('a run uploaded through the API shows on the overview with failures first', async ({ page, request }) => {
  const res = await request.post('/api/ingest', {
    headers: { authorization: `Bearer ${E2E_TOKEN}` },
    data: {
      suite: 'Web E2E (Dev)',
      platform: 'web',
      format: 'allure',
      results: allureFixture,
      github: {
        runId: '42',
        runAttempt: '1',
        runUrl: 'https://github.com/MyStudyLife-App/msl-automation/actions/runs/42',
        sha: 'b7078adde84fb4c3621a5f0d07af5f47b7b7d3a0',
        branch: 'main',
        event: 'schedule',
      },
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.counts).toEqual({ passed: 4, flaky: 2, failed: 4, broken: 0, skipped: 2 });
  expect(body.unknownCaseKeys).toEqual(['AUTH-007']);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Failing now (4)' })).toBeVisible();
  const failing = page.getByRole('region', { name: 'Failing now (4)' });
  await expect(failing.getByRole('row')).toHaveCount(5);
  await expect(failing.getByRole('row').nth(1)).toContainText('AUTH-004');
  await expect(page.getByText('4 failed, 2 flaky, 4 passed, 2 skipped')).toBeVisible();
  await expect(page.getByText('7 cases:')).toBeVisible();

  // The failing case ID links to the case; the test title links to the run, filtered to failures.
  await failing.getByRole('link', { name: 'AUTH-004' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Wrong password shows the generic error');
  await expect(page.getByRole('img', { name: /Results of AUTH-004, oldest to newest: failed, failed/ })).toBeVisible();
});

test('run page: filters count and narrow the results, errors expand, GitHub link is real', async ({ page }) => {
  await page.goto('/runs');
  await page.getByRole('row').nth(1).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Web E2E (Dev)');
  await expect(page.getByRole('link', { name: 'Open the workflow run on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/MyStudyLife-App/msl-automation/actions/runs/42',
  );

  const filters = page.getByRole('navigation', { name: 'Filter results' });
  await expect(filters.getByRole('link', { name: 'All (12)' })).toHaveAttribute('aria-current', 'page');
  await filters.getByRole('link', { name: 'Flaky (2)' }).click();
  await expect(page).toHaveURL(/status=flaky/);
  await expect(page.getByRole('cell', { name: /^Flaky$/ })).toHaveCount(2);
  await page.getByText('Error on the failed attempt').first().click();
  await expect(page.getByText(/ERR_CONNECTION_RESET/).first()).toBeVisible();

  await filters.getByRole('link', { name: 'Known bugs (2)' }).click();
  await expect(page.getByText('AUTH-007 (not in hub)').first()).toBeVisible();
  await expect(page.getByText('Passed, known bug').first()).toBeVisible();

  await filters.getByRole('link', { name: 'Skipped (2)' }).click();
  await expect(page.getByRole('link', { name: 'WEB-09' }).first()).toBeVisible();
});

test('runs list filters by suite', async ({ page, request }) => {
  const junit = readFileSync(path.join(import.meta.dirname, '..', 'src/lib/ingest/__fixtures__/playwright-junit.xml'), 'utf8');
  const res = await request.post('/api/ingest', {
    headers: { authorization: `Bearer ${E2E_TOKEN}` },
    data: { suite: 'iOS E2E (Dev)', platform: 'ios', format: 'junit', junit: [junit] },
  });
  expect(res.status()).toBe(201);

  await page.goto('/runs');
  await expect(page.getByRole('row')).toHaveCount(3);
  await page.getByLabel('Suite').filter({ visible: true }).selectOption('iOS E2E (Dev)');
  await page.getByRole('button', { name: 'Show runs' }).click();
  await expect(page).toHaveURL(/suite=iOS/);
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('row').nth(1)).toContainText('Not from CI');
});

test('case list filters by latest result and search', async ({ page }) => {
  await page.goto('/cases');
  await page.getByLabel('Latest result').filter({ visible: true }).selectOption('failing');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByText('2 cases', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AUTH-004' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WEB-10' })).toBeVisible();

  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/cases$/);
  await expect(page.getByLabel('Latest result').filter({ visible: true })).toHaveValue('');
  await page.getByLabel('Search ID or title').filter({ visible: true }).fill('dark mode');
  await page.getByLabel('Search ID or title').filter({ visible: true }).press('Enter');
  await expect(page.getByText('1 case', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').nth(1)).toContainText('No results yet');

  await page.getByLabel('Search ID or title').filter({ visible: true }).fill('nothing matches this');
  await page.getByLabel('Search ID or title').filter({ visible: true }).press('Enter');
  await expect(page.getByText('No cases match these filters.')).toBeVisible();
});

test('creating and editing a case validates input and saves', async ({ page }) => {
  await page.goto('/cases/new');
  await page.getByLabel('ID', { exact: true }).filter({ visible: true }).fill('not an id');
  await page.getByRole('button', { name: 'Create test case' }).click();
  await expect(page.getByText('Fix the fields marked below.')).toBeVisible();
  await expect(page.getByLabel('ID', { exact: true }).filter({ visible: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('ID must look like AUTH-001')).toBeVisible();
  await expect(page.getByText('Title is required')).toBeVisible();

  await page.getByLabel('ID', { exact: true }).filter({ visible: true }).fill('auth-001');
  await page.getByLabel('Title', { exact: true }).filter({ visible: true }).fill('Duplicate');
  await page.getByRole('button', { name: 'Create test case' }).click();
  await expect(page.getByText('AUTH-001 already exists')).toBeVisible();

  await page.getByLabel('ID', { exact: true }).filter({ visible: true }).fill('api-001');
  await page.getByLabel('Title', { exact: true }).filter({ visible: true }).fill('POST /auth/login returns a token');
  await page.getByLabel('API', { exact: true }).filter({ visible: true }).check();
  await page.getByLabel('Web', { exact: true }).filter({ visible: true }).uncheck();
  await page.getByLabel('Type', { exact: true }).filter({ visible: true }).selectOption('api');
  await page.getByRole('button', { name: 'Create test case' }).click();
  await expect(page).toHaveURL(/\/cases\/API-001$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('POST /auth/login returns a token');
  await expect(page.getByText('No automated results yet.')).toBeVisible();

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Expected result (optional)').filter({ visible: true }).fill('200 with an access token');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(/\/cases\/API-001$/);
  await expect(page.getByRole('heading', { name: 'Expected result' })).toBeVisible();
  await expect(page.getByText('200 with an access token')).toBeVisible();
});

test('unknown case and run show the not-found page', async ({ page }) => {
  await page.goto('/cases/NOPE-404');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await page.goto('/runs/99999');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});

test('theme choice applies, survives a reload, and System clears it', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await page.getByLabel('Theme').filter({ visible: true }).selectOption('dark');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBg).toBe('rgb(21, 23, 26)');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Theme').filter({ visible: true })).toHaveValue('dark');
  await page.getByLabel('Theme').filter({ visible: true }).selectOption('system');
  await expect(html).not.toHaveAttribute('data-theme');
});

test('keyboard: skip link moves to the content, controls show a focus ring', async ({ page }) => {
  await page.goto('/cases');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).toBe('solid');
});

for (const theme of ['light', 'dark'] as const) {
  test(`every page fits a 360px phone without sideways scroll (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    for (const url of ['/', '/cases', '/cases/AUTH-004', '/cases/new', '/cases/import', '/runs', '/runs/1', '/setup']) {
      await page.goto(url);
      await expect(page.locator('main h1').first()).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  });
}
