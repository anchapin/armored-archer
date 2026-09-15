/**
 * Unit tests for scripts/integration-test-summary.ts — issue #1144.
 *
 * Covers the junit parsing (jest-junit subset, entity escaping, self-closing
 * testcases), pass-rate math, the 30-day flake-history window (mirroring the
 * data/godot-flaky-test-history.json shape), flake classification, and the
 * rendered markdown signal surfaces.
 */

import {
  classifyFlakes,
  computeSummary,
  decodeXmlEntities,
  FlakyHistoryFile,
  JunitReport,
  parseJunitXml,
  renderSummaryMarkdown,
  topFailingTests,
  updateFlakyHistory,
} from '../integration-test-summary';

const NOW = new Date('2026-09-15T12:00:00Z');
const OLD = new Date('2026-08-01T12:00:00Z'); // 45 days before NOW — outside window.

/** Realistic jest-junit document: 1 suite, 4 testcases (pass/fail/skip/self-closing). */
const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="jest tests" tests="4" failures="1" errors="0" skipped="1" time="1.25" timestamp="2026-09-15T12:00:00Z">
  <testsuite name="tests/integration/combat_system.test.ts" tests="4" failures="1" errors="0" skipped="1" time="1.25">
    <testcase classname="tests/integration/combat_system.test.ts" name="CombatSystem &gt; resolves a duel" time="0.5"></testcase>
    <testcase classname="tests/integration/combat_system.test.ts" name="CombatSystem &gt; rejects &quot;spoofed&quot; settlement" time="0.25">
      <failure message="Expected: 200&#10;Received: 500">stack trace text</failure>
    </testcase>
    <testcase classname="tests/integration/combat_system.test.ts" name="CombatSystem &gt; skips on cold cache" time="0.0">
      <skipped/>
    </testcase>
    <testcase classname="tests/integration/combat_system.test.ts" name="CombatSystem &gt; self-closing pass" time="0.5"/>
  </testsuite>
</testsuites>`;

describe('decodeXmlEntities', () => {
  it('decodes predefined and numeric entities', () => {
    expect(decodeXmlEntities('a &amp; b')).toBe('a & b');
    expect(decodeXmlEntities('&lt;tag&gt;')).toBe('<tag>');
    expect(decodeXmlEntities('&quot;q&quot; &apos;s&apos;')).toBe('"q" \'s\'');
    expect(decodeXmlEntities('&#65;&#x42;')).toBe('AB');
  });
});

describe('parseJunitXml', () => {
  it('reads root totals and per-testcase statuses', () => {
    const report = parseJunitXml(FIXTURE_XML);
    expect(report.totals).toEqual({ tests: 4, failures: 1, errors: 0, skipped: 1, time: 1.25 });
    expect(report.testCases).toHaveLength(4);
    expect(report.testCases.map((tc) => tc.status)).toEqual([
      'passed',
      'failed',
      'skipped',
      'passed',
    ]);
  });

  it('builds a stable test id from classname :: name and decodes entities', () => {
    const report = parseJunitXml(FIXTURE_XML);
    expect(report.testCases[0].id).toBe(
      'tests/integration/combat_system.test.ts :: CombatSystem > resolves a duel'
    );
    expect(report.testCases[1].name).toBe('CombatSystem > rejects "spoofed" settlement');
  });

  it('captures and truncates the failure message', () => {
    const report = parseJunitXml(FIXTURE_XML);
    expect(report.testCases[1].failureMessage).toContain('Expected: 200');
    expect(report.testCases[1].failureMessage).toContain('Received: 500');
    expect(report.testCases[0].failureMessage).toBeNull();
  });

  it('falls back to suite-level totals when the root carries no counts', () => {
    const report = parseJunitXml(
      `<testsuites><testsuite name="a" tests="2" failures="1" errors="0" skipped="0" time="1">` +
        `<testcase classname="c" name="one" time="0.5"></testcase>` +
        `<testcase classname="c" name="two" time="0.5"><failure message="boom"/></testcase>` +
        `</testsuite></testsuites>`
    );
    expect(report.totals.tests).toBe(2);
    expect(report.totals.failures).toBe(1);
    expect(report.testCases).toHaveLength(2);
  });

  it('treats an <error> child as a failure', () => {
    const report = parseJunitXml(
      `<testsuites tests="1" failures="0" errors="1" skipped="0" time="0">` +
        `<testsuite name="s" tests="1" failures="0" errors="1" skipped="0" time="0">` +
        `<testcase classname="c" name="explodes" time="0"><error message="suite crashed"/></testcase>` +
        `</testsuite></testsuites>`
    );
    expect(report.testCases[0].status).toBe('failed');
    expect(report.testCases[0].failureMessage).toBe('suite crashed');
  });
});

describe('computeSummary', () => {
  it('computes pass rate over executed (non-skipped) tests', () => {
    const report = parseJunitXml(FIXTURE_XML);
    const summary = computeSummary(report);
    expect(summary).toEqual({
      total: 4,
      passed: 2,
      failed: 1,
      skipped: 1,
      suiteErrors: 0,
      passRatePercent: (2 / 3) * 100,
    });
  });

  it('reports a 0% pass rate when nothing executed', () => {
    const empty: JunitReport = {
      totals: { tests: 0, failures: 0, errors: 0, skipped: 0, time: 0 },
      testCases: [],
    };
    expect(computeSummary(empty).passRatePercent).toBe(0);
  });
});

describe('topFailingTests', () => {
  it('caps the failing list at 5', () => {
    const cases = Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`,
      classname: 'c',
      name: `t${i}`,
      time: 0,
      status: 'failed' as const,
      failureMessage: 'x',
    }));
    const report: JunitReport = {
      totals: { tests: 7, failures: 7, errors: 0, skipped: 0, time: 0 },
      testCases: cases,
    };
    expect(topFailingTests(report)).toHaveLength(5);
    expect(topFailingTests(report)[0].id).toBe('t0');
  });
});

describe('updateFlakyHistory', () => {
  it('appends this run and recomputes runs/failures/failure_rate', () => {
    const report = parseJunitXml(FIXTURE_XML);
    const history = updateFlakyHistory({}, report.testCases, NOW, 30);
    const failing =
      history[
        'tests/integration/combat_system.test.ts :: CombatSystem > rejects "spoofed" settlement'
      ];
    expect(failing).toBeDefined();
    expect(failing.runs).toBe(1);
    expect(failing.failures).toBe(1);
    expect(failing.failure_rate).toBe(1);
    expect(failing.history[0].timestamp).toBe(NOW.toISOString());
    expect(failing.history[0].success).toBe(false);
    expect(failing.history[0].error).toContain('Expected: 200');
    // 3 recorded (skipped excluded), godot-shaped keys present.
    expect(Object.keys(history)).toHaveLength(3);
    for (const record of Object.values(history)) {
      expect(record).toHaveProperty('test_name');
      expect(record).toHaveProperty('runs');
      expect(record).toHaveProperty('failures');
      expect(record).toHaveProperty('failure_rate');
      expect(record).toHaveProperty('history');
    }
  });

  it('accumulates across runs and prunes entries older than the window', () => {
    const testName = 'suite :: flaky_case';
    const existing: FlakyHistoryFile = {
      [testName]: {
        test_name: testName,
        runs: 2,
        failures: 1,
        failure_rate: 0.5,
        history: [
          { timestamp: OLD.toISOString(), success: true, duration_ms: 1, error: null }, // pruned
          {
            timestamp: new Date(NOW.getTime() - 3 * 86400000).toISOString(),
            success: false,
            duration_ms: 2,
            error: 'x',
          },
        ],
      },
    };
    const updated = updateFlakyHistory(
      existing,
      [
        {
          id: testName,
          classname: 'suite',
          name: 'flaky_case',
          time: 0.003,
          status: 'passed',
          failureMessage: null,
        },
      ],
      NOW,
      30
    );
    const record = updated[testName];
    expect(record.runs).toBe(2); // old entry pruned, prior-window fail + this pass
    expect(record.failures).toBe(1);
    expect(record.failure_rate).toBeCloseTo(0.5);
    expect(record.history[0].success).toBe(false);
    expect(record.history[1].success).toBe(true);
    expect(record.history[1].duration_ms).toBe(3);
  });

  it('drops tests whose entire history falls outside the window', () => {
    const testName = 'suite :: stale';
    const existing: FlakyHistoryFile = {
      [testName]: {
        test_name: testName,
        runs: 1,
        failures: 0,
        failure_rate: 0,
        history: [{ timestamp: OLD.toISOString(), success: true, duration_ms: 1, error: null }],
      },
    };
    const updated = updateFlakyHistory({}, [], NOW, 30);
    const carried = updateFlakyHistory(existing, [], NOW, 30);
    expect(updated).toEqual({});
    expect(carried).toEqual({});
  });
});

describe('classifyFlakes', () => {
  const record = (name: string, results: boolean[]): FlakyHistoryFile[string] => ({
    test_name: name,
    runs: results.length,
    failures: results.filter((s) => !s).length,
    failure_rate: results.filter((s) => !s).length / results.length,
    history: results.map((success) => ({
      timestamp: NOW.toISOString(),
      success,
      duration_ms: 0,
      error: null,
    })),
  });

  it('separates flaky (mixed) from consistently-failing from stable', () => {
    const history: FlakyHistoryFile = {
      flaky: record('flaky', [true, false, true]),
      broken: record('broken', [false, false]),
      clean: record('clean', [true, true, true]),
    };
    const flakes = classifyFlakes(history);
    expect(flakes.flakyCount).toBe(1);
    expect(flakes.consistentlyFailingCount).toBe(1);
    expect(flakes.topFlaky[0].test_name).toBe('flaky');
  });

  it('orders topFlaky by failure_rate descending', () => {
    const history: FlakyHistoryFile = {
      mild: record('mild', [true, true, true, false]),
      wild: record('wild', [false, false, false, true]),
    };
    const flakes = classifyFlakes(history);
    expect(flakes.topFlaky.map((r) => r.test_name)).toEqual(['wild', 'mild']);
  });
});

describe('renderSummaryMarkdown', () => {
  it('includes counts, pass rate, top-5 failing ids, and flake signal', () => {
    const report = parseJunitXml(FIXTURE_XML);
    const summary = computeSummary(report);
    const history = updateFlakyHistory({}, report.testCases, NOW, 30);
    // Seed a historical pass for the failing test so it reads as flaky.
    const failingId = report.testCases.find((tc) => tc.status === 'failed')!.id;
    history[failingId].history.unshift({
      timestamp: new Date(NOW.getTime() - 86400000).toISOString(),
      success: true,
      duration_ms: 10,
      error: null,
    });
    history[failingId].runs += 1;
    history[failingId].failures = 1;
    history[failingId].failure_rate = 0.5;
    const flakes = classifyFlakes(history);
    const md = renderSummaryMarkdown(
      summary,
      flakes,
      topFailingTests(report),
      'data/backend-flaky-test-history.json'
    );

    expect(md).toContain('## Backend Integration Tests (Nakama + Postgres)');
    expect(md).toContain('| Passed | 2 |');
    expect(md).toContain('| Failed | 1 |');
    expect(md).toContain('| Skipped | 1 |');
    expect(md).toContain('Pass rate (executed)');
    expect(md).toContain(failingId);
    expect(md).toContain('1 flaky test(s)');
    expect(md).toContain('50.0% failure rate (1/2 runs)');
    expect(md).toContain('30-day window');
  });
});
