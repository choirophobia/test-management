import { XMLParser } from 'fast-xml-parser';
import type { ResultStatus } from '@/db/schema';
import { caseKeysFromTitle, mergeCaseKeys } from './case-keys';
import { clip, type ParsedResult } from './types';

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  cdataPropName: 'cdata',
  isArray: (name) => ['testsuite', 'testcase', 'failure', 'error', 'skipped', 'property'].includes(name),
  // Test titles and messages stay strings: "001" must not become 1.
  parseAttributeValue: false,
  processEntities: true,
});

const list = (value: unknown): Node[] => (Array.isArray(value) ? (value as Node[]) : []);
const str = (value: unknown): string | null => (typeof value === 'string' && value.length ? value : null);

function textOf(node: Node | undefined): string | null {
  if (!node) return null;
  const parts = [node.cdata, node.text].flat().filter((p): p is string => typeof p === 'string');
  return parts.join('\n').trim() || null;
}

/** Nested <testsuite> elements (Jest, WDIO) are flattened; the innermost suite name is kept. */
function collectSuites(node: Node, out: Node[]) {
  for (const suite of list(node.testsuite)) {
    out.push(suite);
    collectSuites(suite, out);
  }
}

/**
 * JUnit XML from Playwright (`hostname` = project), WDIO (`@wdio/junit-reporter`) or Jest (`jest-junit`).
 * JUnit has no retry history, so a test reported more than once is not marked flaky here.
 */
export function parseJUnit(xml: string): ParsedResult[] {
  const doc = parser.parse(xml) as Node;
  const suites: Node[] = [];
  if (doc.testsuites) collectSuites(doc.testsuites as Node, suites);
  else collectSuites(doc, suites);

  const parsed: ParsedResult[] = [];
  for (const suite of suites) {
    const suiteName = str(suite.name);
    const variant = str(suite.hostname);
    for (const tc of list(suite.testcase)) {
      const name = str(tc.name) ?? '(unnamed test)';
      const failure = list(tc.failure)[0];
      const error = list(tc.error)[0];
      const skipped = list(tc.skipped)[0];
      let status: ResultStatus = 'passed';
      if (failure) status = 'failed';
      else if (error) status = 'broken';
      else if (skipped !== undefined) status = 'skipped';
      const problem = failure ?? error;
      const seconds = Number(tc.time);

      parsed.push({
        name,
        fullName: [str(tc.classname) ?? suiteName, name].filter(Boolean).join(' › '),
        epic: null,
        feature: suiteName,
        variant,
        status,
        knownBug: /^\[known bug\]/i.test(name),
        attempts: 1,
        durationMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : null,
        message: clip(str(problem?.message) ?? textOf(problem)?.split('\n')[0]),
        trace: clip(textOf(problem)),
        caseKeys: mergeCaseKeys(caseKeysFromTitle(name)),
        tags: [],
        startedAt: null,
        finishedAt: null,
      });
    }
  }
  return parsed;
}
