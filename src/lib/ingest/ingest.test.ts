import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allurePayload, parseAllure } from './allure';
import { caseKeysFromTitle } from './case-keys';
import { parseJUnit } from './junit';
import { countStatuses, type ParsedResult } from './types';

// Both fixtures are real output from one Playwright run (allure-playwright 3.13.0, the version
// msl-automation uses) of six tests in chromium and firefox with retries: 1.
const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
const allure = parseAllure(allurePayload.parse(JSON.parse(fixture('allure-results.json'))));

function find(results: ParsedResult[], prefix: string, variant: string) {
  const r = results.find((x) => x.name.startsWith(prefix) && x.variant === variant);
  if (!r) throw new Error(`no result for ${prefix} in ${variant}`);
  return r;
}

describe('caseKeysFromTitle', () => {
  it.each([
    ['AUTH-001 valid credentials log in', ['AUTH-001']],
    ['RESET-006 / ON-04 a new password works', ['RESET-006', 'ON-04']],
    ['TZK-32 / TZK-33 control: New York and London', ['TZK-32', 'TZK-33']],
    ['[known bug] AY-04 a one-day holiday hides a class', ['AY-04']],
    ['[known bug] [simulated Stripe] SUB-WB-01 paid plan unlocks', ['SUB-WB-01']],
  ])('%s', (title, expected) => {
    expect(caseKeysFromTitle(title)).toEqual(expected);
  });

  it('ignores IDs that are not at the start, such as a Jira key', () => {
    expect(caseKeysFromTitle('subscription page matches MSL-33 Part 1')).toEqual([]);
  });
});

describe('parseAllure', () => {
  it('folds retries into one result per test and browser', () => {
    expect(allure).toHaveLength(12);
    expect(new Set(allure.map((r) => r.variant))).toEqual(new Set(['chromium', 'firefox']));
  });

  it('marks a pass after a failed attempt as flaky and keeps the failed attempt message', () => {
    const r = find(allure, 'RESET-006', 'firefox');
    expect(r.status).toBe('flaky');
    expect(r.attempts).toBe(2);
    expect(r.message).toContain('ERR_CONNECTION_RESET');
    expect(r.caseKeys).toEqual(['ON-04', 'RESET-006']);
  });

  it('keeps a test that failed every attempt as failed, with its assertion message', () => {
    const r = find(allure, 'AUTH-004', 'chromium');
    expect(r.status).toBe('failed');
    expect(r.attempts).toBe(2);
    expect(r.message).toContain('error toast text');
    expect(r.epic).toBe('Authentication');
    expect(r.feature).toBe('Login');
  });

  it('flags known bugs from the tag, as passed results', () => {
    const r = find(allure, '[known bug] AUTH-007', 'chromium');
    expect(r.status).toBe('passed');
    expect(r.knownBug).toBe(true);
    expect(r.caseKeys).toEqual(['AUTH-007']);
  });

  it('reports fixme (manual-only) tests as skipped', () => {
    expect(find(allure, 'WEB-09', 'firefox').status).toBe('skipped');
  });

  it('counts the whole run', () => {
    expect(countStatuses(allure)).toEqual({ passed: 4, flaky: 2, failed: 4, broken: 0, skipped: 2 });
  });
});

describe('parseJUnit', () => {
  const junit = parseJUnit(fixture('playwright-junit.xml'));

  it('reads every test case with its browser', () => {
    expect(junit).toHaveLength(12);
    expect(find(junit, 'AUTH-001', 'chromium').status).toBe('passed');
  });

  it('reads failures with their message and trace', () => {
    const r = find(junit, 'AUTH-004', 'firefox');
    expect(r.status).toBe('failed');
    expect(r.message).toBe('error toast text');
    expect(r.trace).toContain('Expected: "Oops!! Wrong password"');
  });

  it('reads skipped tests and case IDs', () => {
    const r = find(junit, 'WEB-09', 'chromium');
    expect(r.status).toBe('skipped');
    expect(r.caseKeys).toEqual(['WEB-09']);
  });

  it('reads nested suites from Jest-style reports', () => {
    const xml = `<?xml version="1.0"?>
      <testsuites name="jest tests">
        <testsuite name="Auth API" tests="2">
          <testcase classname="Auth API POST /auth/login" name="API-001 returns a token" time="0.12"/>
          <testcase classname="Auth API POST /auth/login" name="API-002 rejects a wrong password" time="0.08">
            <failure message="expected 401, got 500">Error: expected 401, got 500</failure>
          </testcase>
        </testsuite>
      </testsuites>`;
    const r = parseJUnit(xml);
    expect(r.map((x) => [x.caseKeys[0], x.status, x.durationMs])).toEqual([
      ['API-001', 'passed', 120],
      ['API-002', 'failed', 80],
    ]);
  });
});
