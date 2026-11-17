#!/usr/bin/env node
// Sends a folder of test results to MSL Test Hub. No dependencies: copy this file into any repo.
//
//   node hub-upload.mjs --suite "Web E2E (Dev)" --platform web --format allure --dir allure-results
//   node hub-upload.mjs --suite "iOS E2E (Dev)" --platform ios --format junit --dir junit-results
//
// Needs HUB_URL (e.g. https://test-hub.example.com) and HUB_INGEST_TOKEN. In GitHub Actions the run
// ID, attempt, commit, branch and run URL are read from the standard GITHUB_* variables, so a re-run
// of the upload step replaces that run instead of adding a copy.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    suite: { type: 'string' },
    platform: { type: 'string', default: 'web' },
    format: { type: 'string', default: 'allure' },
    dir: { type: 'string' },
  },
});

function fail(message) {
  console.error(`hub-upload: ${message}`);
  process.exit(1);
}

const hubUrl = process.env.HUB_URL?.replace(/\/+$/, '');
const token = process.env.HUB_INGEST_TOKEN;
if (!hubUrl) fail('HUB_URL is not set.');
if (!token) fail('HUB_INGEST_TOKEN is not set.');
if (!args.suite) fail('--suite is required, e.g. --suite "Web E2E (Dev)".');
if (!args.dir) fail('--dir is required.');
if (!['allure', 'junit'].includes(args.format)) fail('--format must be "allure" or "junit".');

let files;
try {
  files = readdirSync(args.dir);
} catch {
  fail(`cannot read ${args.dir}. Did the test step produce results?`);
}

const body = { suite: args.suite, platform: args.platform, format: args.format };

if (args.format === 'allure') {
  // Steps, attachments and links are not used by the hub and make up most of the size.
  body.results = files
    .filter((f) => f.endsWith('-result.json'))
    .map((f) => {
      const r = JSON.parse(readFileSync(path.join(args.dir, f), 'utf8'));
      const { name, fullName, historyId, status, statusDetails, labels, parameters, start, stop } = r;
      return { name, fullName, historyId, status, statusDetails, labels, parameters, start, stop };
    });
  if (!body.results.length) fail(`no *-result.json files in ${args.dir}.`);
} else {
  body.junit = files.filter((f) => f.endsWith('.xml')).map((f) => readFileSync(path.join(args.dir, f), 'utf8'));
  if (!body.junit.length) fail(`no .xml files in ${args.dir}.`);
}

if (process.env.GITHUB_RUN_ID) {
  body.github = {
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
    runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    sha: process.env.GITHUB_SHA,
    branch: process.env.GITHUB_REF_NAME,
    event: process.env.GITHUB_EVENT_NAME,
  };
}

const response = await fetch(`${hubUrl}/api/ingest`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
}).catch((error) => fail(`could not reach ${hubUrl}: ${error.message}`));

const text = await response.text();
if (!response.ok) fail(`HTTP ${response.status}: ${text}`);

const out = JSON.parse(text);
const c = out.counts;
console.log(
  `Uploaded ${out.results} results: ${c.passed} passed, ${c.flaky} flaky, ${c.failed} failed, ${c.broken} broken, ${c.skipped} skipped.`,
);
console.log(`Run: ${out.url}`);
if (out.unknownCaseKeys.length) {
  console.log(`Case IDs in test titles with no case in the hub (${out.unknownCaseKeys.length}): ${out.unknownCaseKeys.join(', ')}`);
}
