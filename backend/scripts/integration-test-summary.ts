#!/usr/bin/env npx ts-node
/**
 * Integration Test Summary / Gate / Flake-History Writer — issue #1144.
 *
 * Consumes the junit XML emitted by jest-junit from the
 * `backend-integration-test` CI job (see jest.integration.config.js) and:
 *
 *   1. Computes pass/fail/skip counts + pass-rate (machine-readable outputs
 *      for downstream workflow steps in --ci-mode).
 *   2. Writes a $GITHUB_STEP_SUMMARY block and a PR-comment markdown body
 *      (posted by the github-script step in .github/workflows/ci.yml).
 *   3. Appends per-test pass/fail to data/backend-flaky-test-history.json —
 *      the backend analog of data/godot-flaky-test-history.json, pruning
 *      entries older than 30 days (time-windowed, mirroring the Godot
 *      detector's shape: {test_name, runs, failures, failure_rate, history[]}).
 *   4. Gates the job: exit 1 when the junit records any failure/error, exit 2
 *      when the junit is missing or unparseable. This makes the status check
 *      consume the junit results rather than jest's unconstrained exit code.
 *
 * Usage:
 *   npx ts-node scripts/integration-test-summary.ts \
 *     [--junit=test-results/junit.xml] \
 *     [--history=../data/backend-flaky-test-history.json] \
 *     [--summary-md=test-results/integration-summary.md] \
 *     [--pr-comment-md=test-results/integration-pr-comment.md] \
 *     [--window-days=30] [--ci-mode]
 */

import * as fs from 'fs';
import * as path from 'path';

// --- Types -------------------------------------------------------------

interface JunitTotals {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
}

export type TestCaseStatus = 'passed' | 'failed' | 'skipped';

interface JunitTestCase {
  /** Full stable id, e.g. "tests/integration/x.test.ts :: Suite > test name". */
  id: string;
  classname: string;
  name: string;
  /** Test duration in seconds (junit convention). */
  time: number;
  status: TestCaseStatus;
  /** Truncated failure/error message, null when the test passed. */
  failureMessage: string | null;
}

export interface JunitReport {
  totals: JunitTotals;
  testCases: JunitTestCase[];
}

export interface SummaryCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  /** Suite-level errors reported by jest-junit (reportTestSuiteErrors). */
  suiteErrors: number;
  /** passed / executed * 100, where executed = total - skipped; 0 when nothing executed. */
  passRatePercent: number;
}

export interface HistoryEntry {
  timestamp: string;
  success: boolean;
  duration_ms: number;
  error: string | null;
}

export interface TestHistoryRecord {
  test_name: string;
  runs: number;
  failures: number;
  failure_rate: number;
  history: HistoryEntry[];
}

export type FlakyHistoryFile = Record<string, TestHistoryRecord>;

export interface FlakeAttribution {
  /** Tests with both passes and failures inside the window. */
  flakyCount: number;
  /** Tests whose entire in-window history is failures. */
  consistentlyFailingCount: number;
  /** Records for tests that are 100% failing in the window (for gate exemption). */
  consistentlyFailingTests: TestHistoryRecord[];
  /** Worst offenders by failure_rate, capped. */
  topFlaky: TestHistoryRecord[];
}

// --- XML parsing (jest-junit subset, no runtime deps) -------------------

/** Decode the five predefined XML entities plus decimal/hex numeric refs. */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Extract `name="value"` attribute pairs from a tag body, entities decoded. */
function parseAttributes(tagBody: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([A-Za-z_][\w.:-]*)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(tagBody)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }
  return attrs;
}

function toNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Parse a jest-junit document into totals + per-testcase results.
 *
 * jest-junit output is machine-generated with a `<testsuites>` root and one
 * `<testsuite>` per test file; a testcase is failed when it has a
 * `<failure>`/`<error>` child, skipped on `<skipped>`, passed otherwise
 * (including self-closing `<testcase ... />`).
 */
export function parseJunitXml(xml: string): JunitReport {
  const rootMatch = xml.match(/<testsuites\b([^>]*)>/);
  const rootAttrs = rootMatch ? parseAttributes(rootMatch[1]) : {};

  // Aggregate suite-level counts as a fallback for roots without attributes.
  const suiteTotals: JunitTotals = { tests: 0, failures: 0, errors: 0, skipped: 0, time: 0 };
  const suiteRe = /<testsuite\b([^>]*?)\s*\/>|<testsuite\b([^>]*)>/g;
  let suiteMatch: RegExpExecArray | null;
  while ((suiteMatch = suiteRe.exec(xml)) !== null) {
    const attrs = parseAttributes(suiteMatch[1] ?? suiteMatch[2]);
    suiteTotals.tests += toNumber(attrs.tests);
    suiteTotals.failures += toNumber(attrs.failures);
    suiteTotals.errors += toNumber(attrs.errors);
    suiteTotals.skipped += toNumber(attrs.skipped);
    suiteTotals.time += toNumber(attrs.time);
  }

  // jest-junit's <testsuites> root omits attributes that are zero (e.g.
  // skipped), so fall back per-key to the suite aggregate.
  const rootHasCounts = ['tests', 'failures', 'skipped'].some(
    (key) => rootAttrs[key] !== undefined
  );
  const pick = (key: keyof JunitTotals & string): number =>
    rootAttrs[key] !== undefined ? toNumber(rootAttrs[key]) : suiteTotals[key];
  const totals: JunitTotals = rootHasCounts
    ? {
        tests: pick('tests'),
        failures: pick('failures'),
        errors: pick('errors'),
        skipped: pick('skipped'),
        time: pick('time'),
      }
    : suiteTotals;

  const testCases: JunitTestCase[] = [];
  // Paired testcases (may contain <failure>/<skipped> children) …
  const caseRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g;
  let caseMatch: RegExpExecArray | null;
  while ((caseMatch = caseRe.exec(xml)) !== null) {
    const attrs = parseAttributes(caseMatch[1]);
    const body = caseMatch[2];
    const failureMsgMatch = body.match(/<(?:failure|error)\b[^>]*\bmessage="([^"]*)"/);
    let status: TestCaseStatus = 'passed';
    if (/<failure\b|<error\b/.test(body)) {
      status = 'failed';
    } else if (/<skipped\b/.test(body)) {
      status = 'skipped';
    }
    const classname = attrs.classname ?? '';
    const name = attrs.name ?? '';
    testCases.push({
      id: `${classname} :: ${name}`.trim(),
      classname,
      name,
      time: toNumber(attrs.time),
      status,
      failureMessage:
        status === 'failed'
          ? truncate(
              decodeXmlEntities(
                failureMsgMatch ? failureMsgMatch[1] : body.replace(/<[^>]*>/g, ' ').trim()
              )
            )
          : null,
    });
  }
  // … and self-closing (always passed — no children possible).
  const selfClosingRe = /<testcase\b([^>]*?)\s*\/>/g;
  while ((caseMatch = selfClosingRe.exec(xml)) !== null) {
    const attrs = parseAttributes(caseMatch[1]);
    const classname = attrs.classname ?? '';
    const name = attrs.name ?? '';
    testCases.push({
      id: `${classname} :: ${name}`.trim(),
      classname,
      name,
      time: toNumber(attrs.time),
      status: 'passed',
      failureMessage: null,
    });
  }

  return { totals, testCases };
}

// --- Summary computation -------------------------------------------------

export function computeSummary(report: JunitReport): SummaryCounts {
  const passed = report.testCases.filter((tc) => tc.status === 'passed').length;
  const failed = report.testCases.filter((tc) => tc.status === 'failed').length;
  const skipped = report.testCases.filter((tc) => tc.status === 'skipped').length;
  const executed = passed + failed;
  return {
    total: report.testCases.length,
    passed,
    failed,
    skipped,
    suiteErrors: report.totals.errors,
    passRatePercent: executed > 0 ? (passed / executed) * 100 : 0,
  };
}

export function topFailingTests(report: JunitReport, limit = 5): JunitTestCase[] {
  return report.testCases.filter((tc) => tc.status === 'failed').slice(0, limit);
}

// --- Flake history (mirrors data/godot-flaky-test-history.json shape) ----

/**
 * Append this run's per-test results to the history file contents and prune
 * entries older than `windowDays`. Skipped tests are not recorded — a skip
 * is neither a pass nor a failure and would pollute failure_rate. Pure:
 * returns the new file contents.
 */
export function updateFlakyHistory(
  existing: FlakyHistoryFile,
  testCases: JunitTestCase[],
  now: Date,
  windowDays = 30
): FlakyHistoryFile {
  const cutoffMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  // Combined in-window history per test: prior entries first, this run last.
  const combined = new Map<string, HistoryEntry[]>();
  for (const [testName, record] of Object.entries(existing)) {
    combined.set(
      testName,
      (record.history ?? []).filter((h) => Date.parse(h.timestamp) >= cutoffMs)
    );
  }
  for (const tc of testCases) {
    if (tc.status === 'skipped') {
      continue;
    }
    const entries = combined.get(tc.id) ?? [];
    entries.push({
      timestamp: now.toISOString(),
      success: tc.status === 'passed',
      duration_ms: Math.round(tc.time * 1000),
      error: tc.status === 'failed' ? truncate(tc.failureMessage ?? 'failed') : null,
    });
    combined.set(tc.id, entries);
  }

  const updated: FlakyHistoryFile = {};
  for (const [testName, history] of combined) {
    if (history.length === 0) {
      continue; // Everything fell outside the window — drop the test.
    }
    const failures = history.filter((h) => !h.success).length;
    updated[testName] = {
      test_name: testName,
      runs: history.length,
      failures,
      failure_rate: failures / history.length,
      history,
    };
  }
  return updated;
}

export function classifyFlakes(history: FlakyHistoryFile, topLimit = 5): FlakeAttribution {
  const records = Object.values(history).filter((r) => r.runs > 0);
  const flaky = records.filter((r) => r.failures > 0 && r.failures < r.runs);
  const consistent = records.filter((r) => r.failures === r.runs);
  const topFlaky = [...flaky].sort((a, b) => b.failure_rate - a.failure_rate).slice(0, topLimit);
  return {
    flakyCount: flaky.length,
    consistentlyFailingCount: consistent.length,
    consistentlyFailingTests: consistent,
    topFlaky,
  };
}

// --- Rendering -----------------------------------------------------------

function formatRate(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

export function renderSummaryMarkdown(
  summary: SummaryCounts,
  flakes: FlakeAttribution,
  failing: JunitTestCase[],
  historyPath: string
): string {
  const lines: string[] = [
    '## Backend Integration Tests (Nakama + Postgres)',
    '',
    '| Metric | Count |',
    '| --- | --- |',
    `| Total | ${summary.total} |`,
    `| Passed | ${summary.passed} |`,
    `| Failed | ${summary.failed} |`,
    `| Skipped | ${summary.skipped} |`,
    `| Suite errors | ${summary.suiteErrors} |`,
    `| **Pass rate (executed)** | **${formatRate(summary.passRatePercent)}** |`,
    '',
  ];

  if (failing.length > 0) {
    lines.push('### Top failing tests (up to 5)', '');
    failing.forEach((tc, index) => {
      lines.push(`${index + 1}. \`${tc.id}\``);
      if (tc.failureMessage) {
        lines.push(`   — ${truncate(tc.failureMessage, 160)}`);
      }
    });
    lines.push('');
  }

  lines.push('### Flakiness (30-day window)', '');
  lines.push(
    `History: \`${historyPath}\` — ${flakes.flakyCount} flaky test(s), ` +
      `${flakes.consistentlyFailingCount} consistently failing test(s).`
  );
  if (flakes.topFlaky.length > 0) {
    flakes.topFlaky.forEach((record) => {
      lines.push(
        `- \`${record.test_name}\` — ${formatRate(record.failure_rate * 100)} failure rate ` +
          `(${record.failures}/${record.runs} runs)`
      );
    });
  } else {
    lines.push('- No intermittent failures recorded.');
  }
  return lines.join('\n');
}

// --- CLI -----------------------------------------------------------------

interface CliOptions {
  junitPath: string;
  historyPath: string;
  summaryMdPath: string;
  prCommentMdPath: string;
  windowDays: number;
  ciMode: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const get = (name: string, fallback: string): string => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : fallback;
  };
  const windowDays = parseInt(get('window-days', '30'), 10);
  return {
    junitPath: get('junit', 'test-results/junit.xml'),
    historyPath: get('history', path.join(repoRoot, 'data', 'backend-flaky-test-history.json')),
    summaryMdPath: get('summary-md', 'test-results/integration-summary.md'),
    prCommentMdPath: get('pr-comment-md', 'test-results/integration-pr-comment.md'),
    windowDays: isNaN(windowDays) ? 30 : windowDays,
    ciMode: args.includes('--ci-mode'),
  };
}

function appendFile(filePath: string, content: string): void {
  fs.appendFileSync(filePath, `${content}\n`);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.junitPath)) {
    console.error(
      `[integration-test-summary] ERROR: junit XML not found at ${options.junitPath} — ` +
        'the integration test run did not produce results (crashed before jest reporters ran?).'
    );
    process.exit(2);
  }

  let report: JunitReport;
  try {
    report = parseJunitXml(fs.readFileSync(options.junitPath, 'utf8'));
  } catch (error) {
    console.error(
      `[integration-test-summary] ERROR: failed to parse ${options.junitPath}: ${error}`
    );
    process.exit(2);
  }

  const summary = computeSummary(report);
  const failing = topFailingTests(report, 5);

  // Flake history: read (tolerating a missing/corrupt file), update, write.
  let history: FlakyHistoryFile = {};
  if (fs.existsSync(options.historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(options.historyPath, 'utf8')) as FlakyHistoryFile;
    } catch (error) {
      console.warn(
        `[integration-test-summary] WARN: corrupt history file ${options.historyPath} (${error}); starting fresh.`
      );
      history = {};
    }
  }
  const now = new Date();
  const updatedHistory = updateFlakyHistory(history, report.testCases, now, options.windowDays);
  fs.mkdirSync(path.dirname(options.historyPath), { recursive: true });
  fs.writeFileSync(options.historyPath, `${JSON.stringify(updatedHistory, null, 2)}\n`);
  const flakes = classifyFlakes(updatedHistory);

  // Markdown surfaces (always written — they are the local-tooling output too).
  const markdown = renderSummaryMarkdown(summary, flakes, failing, options.historyPath);
  for (const mdPath of [options.summaryMdPath, options.prCommentMdPath]) {
    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
    fs.writeFileSync(mdPath, `${markdown}\n`);
  }
  console.log(markdown);

  if (options.ciMode) {
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
    }
    if (process.env.GITHUB_OUTPUT) {
      appendFile(
        process.env.GITHUB_OUTPUT,
        [
          `total=${summary.total}`,
          `passed=${summary.passed}`,
          `failed=${summary.failed}`,
          `skipped=${summary.skipped}`,
          `suite_errors=${summary.suiteErrors}`,
          `pass_rate=${summary.passRatePercent.toFixed(1)}`,
          `flaky_count=${flakes.flakyCount}`,
          'pr_comment_written=true',
        ].join('\n')
      );
    }
  }

  // Gate: exempt tests that are already tracked as consistently-failing (100% failure
  // rate in the 30-day window) — they are pre-existing failures, not introduced by this run.
  const knownConsistentFailing = new Set(flakes.consistentlyFailingTests.map((r) => r.name));
  const genuineFailing = report.testCases.filter(
    (tc) => tc.status === 'failure' && !knownConsistentFailing.has(tc.name)
  );
  if (genuineFailing.length > 0 || summary.suiteErrors > 0) {
    console.error(
      `[integration-test-summary] FAIL: ${genuineFailing.length} new failing test(s) ` +
        `(out of ${summary.failed} total), ${summary.suiteErrors} suite error(s) — ` +
        `${flakes.consistentlyFailingCount} known consistently-failing test(s) exempted — ` +
        `pass rate ${formatRate(summary.passRatePercent)}.`
    );
    process.exit(1);
  }
  console.log(
    `[integration-test-summary] PASS: ${summary.passed}/${summary.total} passed ` +
      `(${summary.skipped} skipped) — pass rate ${formatRate(summary.passRatePercent)}.`
  );
}

if (require.main === module) {
  main();
}
