import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const PLATFORMS = ['web', 'ios', 'android', 'api'] as const;
export const CASE_TYPES = ['ui', 'api', 'performance'] as const;
export const AUTOMATION = ['manual', 'automated', 'planned'] as const;
export const RESULT_STATUSES = ['passed', 'flaky', 'failed', 'broken', 'skipped'] as const;

export type Platform = (typeof PLATFORMS)[number];
export type CaseType = (typeof CASE_TYPES)[number];
export type Automation = (typeof AUTOMATION)[number];
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const testCases = pgTable(
  'test_cases',
  {
    id: serial('id').primaryKey(),
    // The sheet's ID (AUTH-001, RESET-006). Automated test titles start with it, which is how results link back.
    caseKey: text('case_key').notNull(),
    title: text('title').notNull(),
    section: text('section'),
    platforms: text('platforms').array().$type<Platform[]>().notNull().default(sql`'{web}'::text[]`),
    type: text('type').$type<CaseType>().notNull().default('ui'),
    priority: text('priority'),
    preconditions: text('preconditions'),
    steps: text('steps'),
    expected: text('expected'),
    automation: text('automation').$type<Automation>().notNull().default('manual'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('test_cases_case_key_idx').on(t.caseKey), index('test_cases_section_idx').on(t.section)],
);

export const runs = pgTable(
  'runs',
  {
    id: serial('id').primaryKey(),
    // Workflow or suite name as sent by the uploader, e.g. "Web E2E (Dev)".
    suite: text('suite').notNull(),
    platform: text('platform').$type<Platform>().notNull(),
    format: text('format').$type<'allure' | 'junit'>().notNull(),
    // `${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}` for CI runs; a re-upload with the same value replaces the run.
    externalId: text('external_id'),
    githubRunUrl: text('github_run_url'),
    githubEvent: text('github_event'),
    branch: text('branch'),
    commitSha: text('commit_sha'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    // Counts are stored at ingest so lists never aggregate every result.
    passed: integer('passed').notNull().default(0),
    flaky: integer('flaky').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    broken: integer('broken').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('runs_suite_external_idx').on(t.suite, t.externalId),
    index('runs_started_idx').on(t.startedAt),
  ],
);

export const results = pgTable(
  'results',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    fullName: text('full_name'),
    epic: text('epic'),
    feature: text('feature'),
    // Browser project for Playwright (chromium, firefox), device for mobile.
    variant: text('variant'),
    status: text('status').$type<ResultStatus>().notNull(),
    knownBug: boolean('known_bug').notNull().default(false),
    attempts: integer('attempts').notNull().default(1),
    durationMs: integer('duration_ms'),
    message: text('message'),
    trace: text('trace'),
    caseKeys: text('case_keys').array().notNull().default(sql`'{}'::text[]`),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    index('results_run_idx').on(t.runId),
    index('results_case_keys_idx').using('gin', t.caseKeys),
  ],
);

// Reserved for k6 summaries. Nothing writes here yet: there are no performance tests.
export const perfMetrics = pgTable(
  'perf_metrics',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    p95Ms: real('p95_ms'),
    p99Ms: real('p99_ms'),
    requestsPerSecond: real('requests_per_second'),
    errorRate: real('error_rate'),
    thresholdsPassed: boolean('thresholds_passed'),
    raw: jsonb('raw'),
  },
  (t) => [index('perf_metrics_run_idx').on(t.runId)],
);

export type TestCase = typeof testCases.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Result = typeof results.$inferSelect;
