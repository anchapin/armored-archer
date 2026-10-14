#!/usr/bin/env npx ts-node
/** Bounded full-suite Jest sampling. Never infer test results from source labels. */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TestRun {
  timestamp: string;
  success: boolean;
  duration: number;
  error?: string;
}
export interface TestResult {
  testName: string;
  runs: number;
  failures: number;
  failureRate: number;
  history: TestRun[];
}
interface JestAssertion {
  fullName: string;
  location?: { line: number; column: number } | null;
  status: string;
  duration?: number | null;
  failureMessages?: string[];
}
export interface JestResult {
  testResults: {
    name: string;
    assertionResults: JestAssertion[];
    testExecError?: unknown;
  }[];
}
export interface DetectionResult {
  flakyTests: TestResult[];
  consistentlyFailingTests: TestResult[];
  summary: { totalTests: number; skippedTests: number; runsPerTest: number; threshold: number; executionTime: number };
}

/** File plus full name avoids collisions between suites with identical names. */
export function readAssertions(result: JestResult, root: string): Map<string, TestRun> {
  if (!Array.isArray(result.testResults) || result.testResults.length === 0) {
    throw new Error('Jest returned no suites; detection is incomplete');
  }
  const assertions = new Map<string, TestRun>();
  for (const suite of result.testResults) {
    const occurrences = new Map<string, number>();
    if (suite.testExecError || !Array.isArray(suite.assertionResults)) {
      throw new Error('Jest suite could not execute; detection is incomplete');
    }
    for (const assertion of suite.assertionResults) {
      const base = `${path.relative(root, suite.name)} :: ${assertion.fullName}`;
      const occurrence = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, occurrence);
      const location = assertion.location ? ` @${assertion.location.line}:${assertion.location.column}` : '';
      const key = `${base}${location} #${occurrence}`;
      if (assertions.has(key)) throw new Error(`Duplicate suite identity: ${key}`);
      if (!['passed', 'failed', 'pending', 'todo', 'disabled'].includes(assertion.status)) {
        throw new Error(`Unknown Jest assertion status: ${assertion.status}`);
      }
      assertions.set(key, {
        timestamp: new Date().toISOString(),
        success: assertion.status === 'passed',
        duration: assertion.duration ?? 0,
        // Skipped assertions remain in the sample but never count as passes.
        error: ['pending', 'todo', 'disabled'].includes(assertion.status)
          ? 'SKIPPED' : assertion.failureMessages?.join('\n').slice(0, 500),
      });
    }
  }
  if (assertions.size === 0) throw new Error('Jest returned no assertions; detection is incomplete');
  return assertions;
}

export function analyzeSamples(samples: Map<string, TestRun>[], threshold: number): DetectionResult {
  if (samples.length < 2) throw new Error('At least two suite samples are required');
  const keys = [...samples[0].keys()];
  if (samples.some(sample => sample.size !== keys.length || keys.some(key => !sample.has(key)))) {
    throw new Error('Test identities changed between runs; detection is incomplete');
  }
  const flakyTests: TestResult[] = [];
  const consistentlyFailingTests: TestResult[] = [];
  let skippedTests = 0;
  for (const testName of keys) {
    const history = samples.map(sample => sample.get(testName)!);
    if (history.some(run => run.error === 'SKIPPED')) {
      if (!history.every(run => run.error === 'SKIPPED')) {
        throw new Error('Execution/skip status changed between runs; detection is incomplete');
      }
      skippedTests++;
      continue;
    }
    const failures = history.filter(run => !run.success).length;
    const result = { testName, history, failures, runs: history.length, failureRate: failures / history.length };
    if (failures === history.length) consistentlyFailingTests.push(result);
    else if (failures > 0 && result.failureRate >= threshold) flakyTests.push(result);
  }
  return {
    flakyTests, consistentlyFailingTests,
    summary: { totalTests: keys.length - skippedTests, skippedTests, runsPerTest: samples.length, threshold, executionTime: 0 },
  };
}

export function sampleSuite(root: string, outputFile: string, pattern?: string): Map<string, TestRun> {
  const args = [require.resolve('jest/bin/jest'), '--runInBand', '--no-coverage', '--json',
    `--outputFile=${outputFile}`, '--forceExit', '--testLocationInResults', '--passWithNoTests=false'];
  if (pattern) args.push('--testNamePattern', pattern);
  const child = spawnSync(process.execPath, args, {
    cwd: root, env: { ...process.env, CI: 'true' }, encoding: 'utf8',
    timeout: 300_000, maxBuffer: 16 * 1024 * 1024,
  });
  if (child.error || child.signal || child.status === null || ![0, 1].includes(child.status) || !fs.existsSync(outputFile)) {
    throw new Error('Jest process failed or exceeded the five-minute sample budget; detection is incomplete');
  }
  const assertions = readAssertions(JSON.parse(fs.readFileSync(outputFile, 'utf8')), root);
  if (child.status === 1 && ![...assertions.values()].some(run => !run.success && run.error !== 'SKIPPED')) {
    throw new Error('Jest exited unsuccessfully without failed assertions; detection is incomplete');
  }
  return assertions;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: test:flaky [--runs=2|3] [--threshold=0..1] [--test-pattern=REGEX] [--ci-mode]');
    return;
  }
  const value = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const runs = Number(value('runs', '3'));
  const threshold = Number(value('threshold', '0.33'));
  const pattern = value('test-pattern', '');
  if (!Number.isInteger(runs) || runs < 2 || runs > 3) throw new Error('runs must be 2 or 3');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('threshold must be between 0 and 1');
  if (pattern.length > 500) throw new Error('test-pattern exceeds the 500-character budget');
  const root = path.resolve(__dirname, '..');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-flaky-'));
  const start = Date.now();
  try {
    const samples: Map<string, TestRun>[] = [];
    for (let i = 0; i < runs; i++) {
      console.log(`Suite sample ${i + 1}/${runs} (five-minute budget)`);
      samples.push(sampleSuite(root, path.join(scratch, `${i}.json`), pattern));
    }
    const result = analyzeSamples(samples, threshold);
    result.summary.executionTime = Date.now() - start;
    const dataDir = path.join(root, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'flaky-test-latest.json'), JSON.stringify(result, null, 2));
    const historyPath = path.join(dataDir, 'flaky-test-history.json');
    let history: Record<string, TestResult> = {};
    if (fs.existsSync(historyPath)) history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    for (const test of result.flakyTests) {
      const merged = [...(history[test.testName]?.history ?? []), ...test.history].slice(-30);
      const failures = merged.filter(run => !run.success).length;
      history[test.testName] = { ...test, history: merged, runs: merged.length, failures, failureRate: failures / merged.length };
    }
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    const report = [
      '# Backend flake sample', '',
      `${result.summary.totalTests} executed tests, ${result.summary.skippedTests} skipped, ${runs} full-suite runs.`,
      `${result.flakyTests.length} intermittent failures at threshold ${threshold}; ${result.consistentlyFailingTests.length} consistent failures.`,
      'This sample is advisory, not a required gate or proof that tests cannot flake.', '',
      '## Intermittent failures', ...result.flakyTests.map(test => `- ${test.testName}: ${test.failures}/${test.runs}`), '',
      '## Consistent failures', ...result.consistentlyFailingTests.map(test => `- ${test.testName}: ${test.failures}/${test.runs}`), '',
    ].join('\n');
    fs.writeFileSync(path.join(dataDir, 'flaky-tests-report.md'), report);
    console.log(JSON.stringify(result.summary));
    if (args.includes('--ci-mode') && (result.flakyTests.length || result.consistentlyFailingTests.length)) process.exitCode = 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
