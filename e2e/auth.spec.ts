import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OUTBOX } from '../playwright.config';

// These start signed out; every other spec uses the session from global-setup.
test.use({ storageState: { cookies: [], origins: [] } });
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

function mailsTo(email: string): { to: string; link: string }[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((m) => m.to === email);
}

async function requestLink(page: Page, email: string) {
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByText('Check your email.')).toBeVisible();
}

test('a signed-out visit to any page goes to sign-in, keeping where it was going', async ({ page, request }) => {
  await page.goto('/runs?suite=x');
  await expect(page).toHaveURL(/\/login\?next=%2Fruns%3Fsuite%3Dx$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

  // The ingest API keeps its own token check and is not redirected.
  const ingest = await request.post('/api/ingest', { data: {} });
  expect(ingest.status()).toBe(401);
});

test('an invalid address is rejected before anything is sent', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill('not an email');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  // Scoped to main: Next's route announcer is also an alert.
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Enter an email address, like name@example.com.');
  await expect(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');
});

test('an address that is not allowed sees the same message and gets no email', async ({ page }) => {
  await page.goto('/login');
  await requestLink(page, 'stranger@example.com');
  await expect(page.getByText('If stranger@example.com is allowed to sign in, a link is on its way.')).toBeVisible();
  expect(mailsTo('stranger@example.com')).toEqual([]);
});

test('an allowed address gets a one-time link that signs in and returns to the page it wanted', async ({ page }) => {
  await page.goto('/cases?last=failing');
  await expect(page).toHaveURL(/\/login\?next=/);
  // Allowed through the "@mystudylife.test" domain entry; upper case is normalised.
  await requestLink(page, 'Fikri@MyStudyLife.test');
  const mails = mailsTo('fikri@mystudylife.test');
  expect(mails).toHaveLength(1);
  expect(mails[0].link).toMatch(/^http:\/\/localhost:3100\/login\/verify\?token=[\w-]{43}$/);

  // Opening the link alone does not sign in (mail scanners open links too).
  await page.goto(mails[0].link);
  await expect(page.getByText('Continue as fikri@mystudylife.test?')).toBeVisible();
  const before = await page.context().cookies();
  expect(before.find((c) => c.name === 'hub_session')).toBeUndefined();

  await page.getByRole('button', { name: 'Sign in to MSL Test Hub' }).click();
  await expect(page).toHaveURL(/\/cases\?last=failing$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Test cases' })).toBeVisible();
  await expect(page.getByRole('banner').getByText('fikri@mystudylife.test')).toBeVisible();
  const session = (await page.context().cookies()).find((c) => c.name === 'hub_session');
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });

  // The same link cannot be used twice, even from another browser.
  const other = await page.context().browser()!.newPage({ storageState: { cookies: [], origins: [] } });
  await other.goto(mails[0].link);
  await expect(other.getByRole('heading', { name: 'This link no longer works' })).toBeVisible();
  await other.getByRole('link', { name: 'Get a new link' }).click();
  await expect(other).toHaveURL(/\/login$/);
  await other.close();

  // Signing out ends the session on the server, not only in this browser.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.context().addCookies([{ ...session!, expires: session!.expires }]);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.getByText('Your session ended. Sign in again to continue.')).toBeVisible();
});

test('a made-up or tampered link is refused', async ({ page }) => {
  await page.goto('/login/verify?token=not-a-real-token');
  await expect(page.getByRole('heading', { name: 'This link no longer works' })).toBeVisible();
  await page.goto('/login/verify');
  await expect(page.getByRole('heading', { name: 'This link no longer works' })).toBeVisible();
});

test('asking for many links for one address stops sending after five', async ({ page }) => {
  for (let i = 0; i < 7; i++) {
    await page.goto('/login');
    await requestLink(page, 'qa@example.com');
  }
  expect(mailsTo('qa@example.com')).toHaveLength(5);
});

test('a redirect target that leaves the site is ignored', async ({ page }) => {
  await page.goto('/login?next=//evil.example.com');
  await requestLink(page, 'qa@example.com');
  // The rate limit above already used this address up; use the domain entry instead.
  await page.goto('/login?next=//evil.example.com');
  await requestLink(page, 'other@mystudylife.test');
  const [mail] = mailsTo('other@mystudylife.test');
  await page.goto(mail.link);
  await page.getByRole('button', { name: 'Sign in to MSL Test Hub' }).click();
  await expect(page).toHaveURL('http://localhost:3100/');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
});
